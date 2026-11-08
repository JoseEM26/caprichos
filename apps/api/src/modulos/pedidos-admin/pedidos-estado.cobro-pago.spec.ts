jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

/**
 * H1/H4: confirmar un pago como PAGADO nunca deja el pedido pagado sin Cobro: pasa por CobrosService.cobrar
 * (misma caja, comprobante, ticket y puntos que el cobro de Caja).
 */
describe('registrarPago PAGADO crea el Cobro', () => {
  const cajero: any = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };
  let prisma: any;
  let cobros: any;
  let service: PedidosEstadoService;

  const pedido = (extra: any = {}) => ({
    id: 10n,
    codigo: 'CP-10',
    estado: 'COLA',
    modalidad: 'LLEVAR',
    pago_metodo: null,
    pago_estado: 'PENDIENTE',
    total: 40,
    propina: 0,
    es_personal: false,
    planPago: [],
    cobros: [],
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }), findFirst: jest.fn().mockResolvedValue(null) },
      pedido: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 10n, codigo: 'CP-10', estado: 'COLA', pago_estado: 'PAGADO' }) },
      voucherPago: { findMany: jest.fn().mockResolvedValue([{ medio: null }]), findFirst: jest.fn().mockResolvedValue({ id: 9n }), update: jest.fn() },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
    };
    cobros = { cobrar: jest.fn().mockResolvedValue({ id: '1' }) };
    service = new PedidosEstadoService(prisma, {} as any, { registrar: jest.fn() } as any, undefined, undefined, undefined, undefined, undefined, undefined, cobros);
    prisma.pedido.findUnique.mockResolvedValue(pedido());
  });

  const confirmar = (dto: any = {}) =>
    service.registrarPago(10n, { metodo: 'YAPE', estado: 'PAGADO', sinVoucher: { motivo: 'sin captura', sinCaptura: true }, ...dto } as any, cajero);

  it('Yape confirmado: crea el Cobro por el total y ya no escribe pago_estado a mano', async () => {
    await confirmar();
    expect(cobros.cobrar).toHaveBeenCalledTimes(1);
    const [dto] = cobros.cobrar.mock.calls[0];
    expect(dto.pedidoId).toBe('10');
    expect(dto.pagos).toEqual([{ medio: 'YAPE', monto: 40 }]);
    const data = prisma.pedido.update.mock.calls[0][0].data;
    expect(data.pago_estado).toBeUndefined();
    expect(data.pago_coordinado_en).toBeInstanceOf(Date);
  });

  it('suma la propina del pedido al renglón y respeta el plan guardado', async () => {
    prisma.pedido.findUnique.mockResolvedValue(
      pedido({ propina: 2, planPago: [{ medio: 'YAPE', monto: 30 }, { medio: 'PLIN', monto: 10 }] }),
    );
    await confirmar();
    expect(cobros.cobrar.mock.calls[0][0].pagos).toEqual([
      { medio: 'YAPE', monto: 32 },
      { medio: 'PLIN', monto: 10 },
    ]);
  });

  it('caja cerrada: 409 CAJA_CERRADA y no se marca nada', async () => {
    prisma.caja.findUnique.mockResolvedValue({ estado: 'CERRADA' });
    await expect(confirmar()).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
    expect(cobros.cobrar).not.toHaveBeenCalled();
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('si el cobro falla (p. ej. comprobante sin datos) el pedido no queda pagado', async () => {
    cobros.cobrar.mockRejectedValue(Object.assign(new Error('x'), { response: { codigo: 'COMPROBANTE_DATOS_FALTANTES' } }));
    await expect(confirmar()).rejects.toBeDefined();
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('doble clic: con un cobro vigente o ya PAGADO no se cobra otra vez', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ pago_estado: 'PAGADO', cobros: [{ id: 1n }] }));
    await confirmar();
    expect(cobros.cobrar).not.toHaveBeenCalled();
  });

  it('H4: efectivo PAGADO de un pedido de local entra a caja como Cobro en efectivo', async () => {
    await confirmar({ metodo: 'EFECTIVO' });
    expect(cobros.cobrar.mock.calls[0][0].pagos).toEqual([{ medio: 'EFECTIVO', monto: 40 }]);
  });

  it('por diseño no cobra: crédito del personal y total 0', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ es_personal: true }));
    await confirmar();
    prisma.pedido.findUnique.mockResolvedValue(pedido({ total: 0 }));
    await confirmar();
    expect(cobros.cobrar).not.toHaveBeenCalled();
  });

  it('efectivo contra entrega de un delivery no cobra: entra por la liquidación del repartidor', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'DELIVERY', repartidor_party_id: 5n }));
    await confirmar({ metodo: 'EFECTIVO' }).catch(() => undefined);
    expect(cobros.cobrar).not.toHaveBeenCalled();
  });

  it('COORDINADO no crea cobro (Caja cobra después)', async () => {
    await confirmar({ estado: 'COORDINADO' });
    expect(cobros.cobrar).not.toHaveBeenCalled();
  });
});
