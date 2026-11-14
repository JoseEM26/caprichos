jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';

/**
 * WhatsApp en todos los pedidos: recibido, pago confirmado y entregado salen por cualquier canal y modalidad
 * con celular válido; un aviso por evento y pedido; sin celular, del personal o con el interruptor apagado, nada.
 */
describe('AvisosPedidoService: avisos en todos los pedidos', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let pedido: any;
  let parametros: Record<string, unknown>;
  let etapasCreadas: Set<number>;

  beforeEach(() => {
    pedido = {
      id: BigInt(55), codigo: 'CP-055', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'COMER_LOCAL',
      canal: 'CAJA', es_personal: false, total: 20, pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO',
    };
    parametros = {};
    etapasCreadas = new Set();
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido) },
      parametro: { findUnique: jest.fn(async ({ where }: any) => ({ valor: parametros[where.clave] ?? 'si' })) },
      mensajeReparto: {
        findUnique: jest.fn(async ({ where }: any) => (etapasCreadas.has(where.pedido_id_numero.numero) ? { numero: 1 } : null)),
        create: jest.fn(async ({ data }: any) => { etapasCreadas.add(data.numero); return {}; }),
      },
      conversacion: { upsert: jest.fn().mockResolvedValue({ id: BigInt(5), flujo: null }), update: jest.fn() },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  const casos: [string, string, string][] = [
    ['CARTA', 'RECOGER', 'recojo de la carta'],
    ['CAJA', 'COMER_LOCAL', 'Caja en el local'],
    ['CAJA', 'PARA_LLEVAR', 'Caja para llevar'],
    ['MOZO', 'MESA', 'mozo en mesa'],
    ['BOT', 'DELIVERY', 'delivery por el bot'],
    ['WHATSAPP', 'RECOGER', 'recojo por WhatsApp'],
    ['CARTA', 'DELIVERY', 'delivery de la carta'],
  ];

  it.each(casos)('canal %s / %s (%s): recibido, pago confirmado y entregado se encolan, uno por evento', async (canal, modalidad) => {
    pedido.canal = canal;
    pedido.modalidad = modalidad;
    for (const etapa of ['RECIBIDO', 'ACEPTADO', 'ENTREGADO'] as const) {
      expect((await servicio.avisar(55, etapa)).estado).toBe('ENCOLADO');
    }
    const claves = outbox.encolar.mock.calls.map((c: any[]) => c[0].clave);
    expect(claves).toEqual(['pedido-55-RECIBIDO', 'pedido-55-ACEPTADO', 'pedido-55-ENTREGADO']);
  });

  it('pago confirmado en un pedido que no es delivery usa el texto y la plantilla de «recibimos tu pago»', async () => {
    await servicio.avisar(55, 'ACEPTADO');
    const carga = outbox.encolar.mock.calls[0][0].carga;
    expect(carga.plantillaClave).toBe('PAGO_CONFIRMADO');
    expect(carga.textoLibre).toContain('recibimos tu pago');
  });

  it('sin duplicados: repetir el mismo evento no vuelve a encolar', async () => {
    await servicio.avisar(55, 'ENTREGADO');
    const otra = await servicio.avisar(55, 'ENTREGADO');
    expect(otra.estado).toBe('YA_ENVIADO');
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
  });

  it.each([['vacío', ''], ['relleno 999999999', '999999999'], ['nulo', null]])('celular %s: no sale nada', async (_n, tel) => {
    pedido.cliente_telefono = tel;
    for (const etapa of ['RECIBIDO', 'ACEPTADO', 'ENTREGADO'] as const) {
      expect(await servicio.avisar(55, etapa)).toEqual({ estado: 'OMITIDO', motivo: 'SIN_TELEFONO' });
    }
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('pedido del personal: no sale nada', async () => {
    pedido.es_personal = true;
    expect(await servicio.avisar(55, 'RECIBIDO')).toEqual({ estado: 'OMITIDO', motivo: 'PEDIDO_PERSONAL' });
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('interruptor general apagado: Caja y mozo no reciben nada, pero la carta delivery sigue como hoy', async () => {
    parametros.whatsapp_aviso_todos_pedidos_activo = 'no';
    expect((await servicio.avisar(55, 'ENTREGADO')).motivo).toBe('DESACTIVADO');
    pedido.canal = 'CARTA';
    pedido.modalidad = 'DELIVERY';
    expect((await servicio.avisar(55, 'ENTREGADO')).estado).toBe('ENCOLADO');
  });

  it('interruptor propio apagado (pago confirmado): ese aviso no sale', async () => {
    parametros.whatsapp_aviso_pago_confirmado_activo = 'no';
    expect((await servicio.avisar(55, 'ACEPTADO')).motivo).toBe('DESACTIVADO');
  });
});
