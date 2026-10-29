// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que los otros specs del servicio)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

describe('PedidosEstadoService.misPedidos', () => {
  let prisma: { pedido: { findMany: jest.Mock } };
  let service: PedidosEstadoService;
  const mozo = { partyId: 7n, rol: 'MOZO', debeCambiar: false };

  const pedido = (extra: Record<string, unknown>) => ({
    id: 1n,
    codigo: 'CP-M001',
    estado: 'COLA',
    modalidad: 'MESA',
    mesa_nombre: 'Mesa 3',
    total: '10.50',
    pago_estado: 'PENDIENTE',
    pago_metodo: null,
    creado_en: new Date('2026-10-29T14:00:00Z'),
    lineas: [{ nombre: 'Café', cantidad: 2 }],
    vouchers: [],
    planPago: [],
    ...extra,
  });

  beforeEach(() => {
    // Hoy es 29/10/2026 a las 10:00 en Lima (15:00 UTC): el día empieza a las 05:00 UTC
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    prisma = { pedido: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('solo consulta pedidos del mozo: canal MOZO y su party_id', async () => {
    await service.misPedidos(mozo);

    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.canal).toBe('MOZO');
    expect(where.party_id).toBe(7n);
  });

  it('el rango hoy empieza a medianoche de Lima; ayer cierra donde empieza hoy; 7dias toma 6 días atrás', async () => {
    await service.misPedidos(mozo);
    expect(prisma.pedido.findMany.mock.calls[0][0].where.creado_en).toEqual({
      gte: new Date('2026-10-29T05:00:00Z'),
    });

    await service.misPedidos(mozo, 'ayer');
    expect(prisma.pedido.findMany.mock.calls[1][0].where.creado_en).toEqual({
      gte: new Date('2026-10-28T05:00:00Z'),
      lt: new Date('2026-10-29T05:00:00Z'),
    });

    await service.misPedidos(mozo, '7dias');
    expect(prisma.pedido.findMany.mock.calls[2][0].where.creado_en).toEqual({
      gte: new Date('2026-10-23T05:00:00Z'),
    });
  });

  it('resumen: cuenta en curso y entregados, y suma el total sin los anulados', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({ id: 3n, estado: 'EN_CAMINO', total: '5' }),
      pedido({ id: 2n, estado: 'ENTREGADO', total: '20' }),
      pedido({ id: 1n, estado: 'COLA', total: '10.5' }),
      pedido({ id: 0n, estado: 'ANULADO', total: '100' }),
    ]);

    const res = await service.misPedidos(mozo);

    expect(res.resumen).toEqual({ cantidad: 3, total: 35.5, enCurso: 2, entregados: 1 });
    expect(res.pedidos).toHaveLength(4);
    expect(res.pedidos[0]).toEqual({
      id: '3',
      codigo: 'CP-M001',
      estado: 'EN_CAMINO',
      modalidad: 'MESA',
      mesaNombre: 'Mesa 3',
      total: 5,
      pagoEstado: 'PENDIENTE',
      pagoMetodo: null,
      plan: [],
      montoDigital: 0,
      vouchers: 0,
      tieneVoucherLegible: false,
      creadoEn: new Date('2026-10-29T14:00:00Z'),
      lineas: [{ nombre: 'Café', cantidad: 2 }],
    });
  });

  it('por pedido: pago digital, cantidad de vouchers y si alguno es legible, sin semáforo ni datos extraídos', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({
        id: 5n,
        pago_metodo: 'YAPE',
        vouchers: [{ semaforo: 'ILEGIBLE' }, { semaforo: 'OBSERVADO' }],
      }),
      pedido({ id: 4n, pago_metodo: 'PLIN', vouchers: [{ semaforo: 'ILEGIBLE' }] }),
    ]);

    const res = await service.misPedidos(mozo);

    expect(res.pedidos[0]).toMatchObject({ id: '5', pagoMetodo: 'YAPE', vouchers: 2, tieneVoucherLegible: true });
    expect(res.pedidos[1]).toMatchObject({ id: '4', pagoMetodo: 'PLIN', vouchers: 1, tieneVoucherLegible: false });
    const json = JSON.stringify(res);
    expect(json).not.toContain('semaforo');
    expect(json).not.toContain('extraido');
  });

  it('pide los vouchers del pedido solo con su semáforo', async () => {
    await service.misPedidos(mozo);

    const select = prisma.pedido.findMany.mock.calls[0][0].select;
    expect(select.pago_metodo).toBe(true);
    expect(select.vouchers).toEqual({ select: { semaforo: true } });
  });

  it('sin pedidos en el rango devuelve lista vacía y resumen en cero', async () => {
    const res = await service.misPedidos(mozo, 'ayer');

    expect(res).toEqual({
      pedidos: [],
      resumen: { cantidad: 0, total: 0, enCurso: 0, entregados: 0 },
    });
  });

  it('devuelve el plan de pago y la parte digital (lo que lleva voucher)', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({
        pago_metodo: 'YAPE',
        planPago: [
          { medio: 'EFECTIVO', monto: '4.00' },
          { medio: 'YAPE', monto: '6.50' },
        ],
      }),
    ]);

    const res = await service.misPedidos(mozo);

    expect(res.pedidos[0].plan).toEqual([
      { medio: 'EFECTIVO', monto: 4 },
      { medio: 'YAPE', monto: 6.5 },
    ]);
    expect(res.pedidos[0].montoDigital).toBe(6.5);
  });

  it('sin plan (pedido anterior) devuelve plan vacío y montoDigital 0', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([pedido({ pago_metodo: 'EFECTIVO', planPago: [] })]);

    const res = await service.misPedidos(mozo);

    expect(res.pedidos[0].plan).toEqual([]);
    expect(res.pedidos[0].montoDigital).toBe(0);
  });
});
