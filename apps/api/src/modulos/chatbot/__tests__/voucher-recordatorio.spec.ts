jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ChatbotPlanificadorService } from '../servicios/chatbot-planificador.service';
import { pedidoEsperandoVoucher } from '../servicios/pedido-esperando-voucher.util';
import { TEXTOS_REPARTO } from '../conversacion/textos-reparto';

const AHORA = new Date('2026-10-28T15:00:00.000Z');
const HACE = (min: number) => new Date(AHORA.getTime() - min * 60 * 1000);

/** Pedido digital de la carta que ya recibió su aviso «pedido recibido» hace `minAviso` minutos. */
function construir(overrides: Record<string, any> = {}, minAviso = 5) {
  const pedido = {
    id: BigInt(9),
    estado: 'PENDIENTE',
    pago_estado: 'PENDIENTE',
    pago_metodo: 'YAPE',
    pago_preferido: 'YAPE',
    cliente_telefono: '977503006',
    ...overrides.pedido,
  };
  const prisma: any = {
    parametro: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.clave === 'whatsapp_aviso_voucher_recordatorio_activo'
          ? { valor: overrides.apagado ? 'no' : 'si' }
          : overrides.minutos === undefined ? null : { valor: overrides.minutos },
      ),
    },
    mensajeReparto: {
      findMany: jest.fn(async ({ where }: any) => {
        const aviso = { pedido_id: pedido.id, enviado_en: HACE(minAviso) };
        return aviso.enviado_en <= where.enviado_en.lte && aviso.enviado_en >= where.enviado_en.gte ? [aviso] : [];
      }),
      findUnique: jest.fn(async () => (overrides.yaRecordado ? { numero: 14 } : null)),
    },
    pedido: { findUnique: jest.fn(async () => pedido) },
    voucherPago: { findFirst: jest.fn(async () => (overrides.voucherLegible ? { id: 1 } : null)) },
    conversacion: { findUnique: jest.fn(async () => (overrides.conversacion === undefined ? { id: 5 } : overrides.conversacion)) },
    mensajeChat: { findFirst: jest.fn(async () => (overrides.escribio ? { id: 1 } : null)) },
  };
  const avisos: any = { avisar: jest.fn(async () => ({ estado: 'ENCOLADO' })) };
  const planificador = new ChatbotPlanificadorService(prisma, {} as any, {} as any, undefined, undefined, avisos, undefined, undefined);
  return { planificador, avisos, prisma };
}

describe('Recordatorio de voucher (pedido digital sin comprobante)', () => {
  it('sale a los 3 minutos del aviso cuando sigue sin voucher', async () => {
    const { planificador, avisos } = construir({}, 5);
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(1);
    expect(avisos.avisar).toHaveBeenCalledWith(BigInt(9), 'VOUCHER_RECORDATORIO');
  });

  it('no recuerda avisos de hace horas (pedidos viejos no se tocan)', async () => {
    const { planificador, avisos } = construir({}, 180);
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('respeta el parámetro voucher_recordatorio_min', async () => {
    const { planificador, avisos } = construir({ minutos: 10 }, 5);
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale otra vez si el pedido ya tiene el recordatorio (una sola vez)', async () => {
    const { planificador, avisos } = construir({ yaRecordado: true });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('con su propio aviso apagado no busca pedidos ni envía (el aviso RECIBIDO sigue igual)', async () => {
    const { planificador, avisos, prisma } = construir({ apagado: true });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(prisma.mensajeReparto.findMany).not.toHaveBeenCalled();
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si ya hay un voucher legible del pedido', async () => {
    const { planificador, avisos } = construir({ voucherLegible: true });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si el cliente escribió después del aviso', async () => {
    const { planificador, avisos } = construir({ escribio: true });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si el pedido está anulado', async () => {
    const { planificador, avisos } = construir({ pedido: { estado: 'ANULADO' } });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si el pedido es en efectivo', async () => {
    const { planificador, avisos } = construir({ pedido: { pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO' } });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si el personal confirmó el pago sin captura (cobro_mozo_en)', async () => {
    const { planificador, avisos } = construir({ pedido: { cobro_mozo_en: new Date() } });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('no sale si el pedido ya está pagado', async () => {
    const { planificador, avisos } = construir({ pedido: { pago_estado: 'COORDINADO' } });
    expect(await planificador.avisarFaltaVoucher(AHORA)).toBe(0);
    expect(avisos.avisar).not.toHaveBeenCalled();
  });
});

describe('pedidoEsperandoVoucher (a qué pedido se liga el voucher)', () => {
  const pedido = (id: number, creado: string, extra: Record<string, unknown> = {}) => ({
    id: BigInt(id),
    codigo: `CP-W00${id}`,
    estado: 'PENDIENTE',
    pago_estado: 'PENDIENTE',
    creado_en: new Date(creado),
    ...extra,
  });

  /** Simula la base: findFirst devuelve el primer pedido que cumple id (si viene) o el más reciente. */
  function prismaCon(pedidos: any[]) {
    return {
      pedido: {
        findFirst: jest.fn(async ({ where }: any) => {
          const candidatos = pedidos.filter((p) => {
            if (where.id !== undefined && p.id !== where.id) return false;
            if (where.pago_estado && p.pago_estado !== where.pago_estado) return false;
            return true;
          });
          candidatos.sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());
          return candidatos[0] ?? null;
        }),
      },
    } as any;
  }

  it('usa el pedido que la conversación ya tiene en espera de pago', async () => {
    const prisma = prismaCon([pedido(1, '2026-10-28T14:00:00Z'), pedido(2, '2026-10-28T14:30:00Z')]);
    const r = await pedidoEsperandoVoucher(prisma, { pago: { pedidoId: '1' } }, '977503006');
    expect(r?.id).toBe(BigInt(1));
  });

  it('sin pedido marcado usa el digital pendiente más reciente del cliente', async () => {
    const prisma = prismaCon([pedido(1, '2026-10-28T14:00:00Z'), pedido(2, '2026-10-28T14:30:00Z')]);
    const r = await pedidoEsperandoVoucher(prisma, {}, '977503006');
    expect(r?.id).toBe(BigInt(2));
  });

  it('si el marcado ya no espera pago (pagado o anulado) no lo liga', async () => {
    const prisma = prismaCon([pedido(1, '2026-10-28T14:00:00Z', { pago_estado: 'COORDINADO' })]);
    const r = await pedidoEsperandoVoucher(prisma, { pago: { pedidoId: '1' } }, '977503006');
    expect(r).toBeNull();
  });

  it('sin teléfono usable no liga a ningún pedido', async () => {
    const prisma = prismaCon([pedido(1, '2026-10-28T14:00:00Z')]);
    expect(await pedidoEsperandoVoucher(prisma, {}, '123')).toBeNull();
  });
});

describe('Textos de pago digital', () => {
  it('el aviso pide la foto del voucher por el mismo chat y mantiene el nombre', () => {
    const t = TEXTOS_REPARTO.recibidoDigital('José Ángel', 'CP-W005', 'Yape');
    expect(t.textoLibre).toContain('José Ángel');
    expect(t.textoLibre).toContain('ya está en marcha');
    expect(t.textoLibre).toContain('foto de tu pago por Yape');
    expect(t.textoLibre).toContain('opcional');
    expect(t.plantillaClave).toBe('CARTA_RECIBIDO_DIGITAL');
  });

  it('el recordatorio usa su propia plantilla con nombre y pedido', () => {
    const t = TEXTOS_REPARTO.voucherRecordatorio('Ana', 'CP-W005');
    expect(t.textoLibre).toContain('sigue en marcha');
    expect(t.textoLibre).toContain('es opcional');
    expect(t.textoLibre).toContain('asesor');
    expect(t.plantillaClave).toBe('CARTA_VOUCHER_RECORDATORIO');
    expect(t.variablesPlantilla).toEqual(['Ana', 'CP-W005']);
  });
});
