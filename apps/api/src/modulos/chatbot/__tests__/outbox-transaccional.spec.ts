jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';

/**
 * Base en memoria con transacciones de verdad: si la función de la transacción lanza, lo escrito dentro
 * se deshace. Sirve para probar que el encolado va en la misma transacción que el cambio de estado.
 */
function crearBaseTransaccional() {
  const estado = {
    salientes: [] as any[],
    mensajesReparto: [] as any[],
    pedidos: [
      { id: 77n, codigo: 'CP-077', modalidad: 'DELIVERY', cliente_telefono: '987654321', cliente_nombre: 'Marta', total: 30, pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO' },
    ],
  };
  const tabla = (filas: any[]) => filas;
  const tx: any = {
    salienteWhatsapp: {
      createMany: async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const d of data) {
          if (estado.salientes.some((f) => f.clave_idempotencia === d.clave_idempotencia)) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error('unique'), { code: 'P2002' });
          }
          estado.salientes.push({ id: BigInt(estado.salientes.length + 1), ...d });
          count++;
        }
        return { count };
      },
    },
    mensajeReparto: {
      findUnique: async ({ where }: any) => {
        const k = where.pedido_id_numero;
        return estado.mensajesReparto.find((m) => m.pedido_id === k.pedido_id && m.numero === k.numero) ?? null;
      },
      create: async ({ data }: any) => {
        if (estado.mensajesReparto.some((m) => m.pedido_id === data.pedido_id && m.numero === data.numero)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        estado.mensajesReparto.push({ ...data });
        return data;
      },
    },
    pedido: { findUnique: async ({ where }: any) => tabla(estado.pedidos).find((p) => p.id === where.id) ?? null },
    parametro: { findUnique: async () => ({ valor: 'si' }) },
  };
  const prisma: any = {
    ...tx,
    $transaction: async (fn: any) => {
      const copia = {
        salientes: [...estado.salientes],
        mensajesReparto: [...estado.mensajesReparto],
      };
      try {
        return await fn(tx);
      } catch (err) {
        estado.salientes = copia.salientes;
        estado.mensajesReparto = copia.mensajesReparto;
        throw err;
      }
    },
  };
  return { prisma, estado };
}

describe('Outbox transaccional: el aviso solo existe si el cambio de estado existe', () => {
  let base: ReturnType<typeof crearBaseTransaccional>;
  let outbox: OutboxWhatsappService;
  let avisos: AvisosPedidoService;

  beforeEach(() => {
    base = crearBaseTransaccional();
    const ventana: any = { enviarMensajeNegocio: jest.fn(), tieneConsentimiento: jest.fn() };
    outbox = new OutboxWhatsappService(base.prisma, ventana, { enviarPlantilla: jest.fn() } as any, undefined, undefined);
    // El envío real lo hace el lote; aquí solo interesa lo encolado
    jest.spyOn(outbox, 'despertar').mockImplementation(() => undefined);
    avisos = new AvisosPedidoService(base.prisma, outbox);
  });

  it('(b) commit: el cambio de estado y el aviso quedan juntos, exactamente una fila', async () => {
    await base.prisma.$transaction(async (tx: any) => {
      await avisos.avisar(77, 'LISTO', {}, tx);
    });
    expect(base.estado.salientes).toHaveLength(1);
    expect(base.estado.salientes[0].clave_idempotencia).toBe('pedido-77-LISTO');
    expect(base.estado.mensajesReparto).toHaveLength(1);
  });

  it('(a) rollback: si el cambio de estado falla después del aviso, no queda fila en saliente_whatsapp', async () => {
    await expect(
      base.prisma.$transaction(async (tx: any) => {
        await avisos.avisar(77, 'LISTO', {}, tx);
        // el cambio de estado falla después de encolar
        throw new Error('falla al guardar el cambio de estado');
      }),
    ).rejects.toThrow('falla al guardar el cambio de estado');
    expect(base.estado.salientes).toHaveLength(0);
    expect(base.estado.mensajesReparto).toHaveLength(0);
  });

  it('(b) sin transacción propia: el aviso se encola en su propia transacción y queda una sola fila', async () => {
    await avisos.avisar(77, 'SALIDA');
    expect(base.estado.salientes).toHaveLength(1);
    expect(base.estado.salientes[0].origen).toBe('AVISO_PEDIDO');
  });

  it('idempotencia: encolar dos veces el mismo evento deja una sola fila', async () => {
    await avisos.avisar(77, 'ENTREGADO');
    await avisos.avisar(77, 'ENTREGADO');
    expect(base.estado.salientes).toHaveLength(1);
  });

  it('(a) rollback sin aviso previo: el cambio fallido no deja nada en el outbox', async () => {
    await expect(
      base.prisma.$transaction(async (tx: any) => {
        await outbox.encolar(
          {
            telefono: '51987654321',
            tipo: 'TEXTO',
            clave: 'prueba-rollback',
            origen: 'ESPERA',
            carga: { textoLibre: 'x' },
          },
          tx,
        );
        throw new Error('rollback forzado');
      }),
    ).rejects.toThrow('rollback forzado');
    expect(base.estado.salientes).toHaveLength(0);
  });
});
