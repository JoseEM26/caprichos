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
    cliente_nombre: null,
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

  it('vouchersPorMedio: pedido sin plan con pago YAPE y voucher sin medio (Caja/WhatsApp) cuenta como subido', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({
        pago_metodo: 'YAPE',
        total: '25.00',
        planPago: [],
        vouchers: [{ id: 5n, semaforo: 'CONFIABLE', medio: null, reemplazado_en: null }],
      }),
      pedido({ id: 2n, pago_metodo: 'YAPE', total: '25.00', planPago: [], vouchers: [] }),
    ]);
    const res = await service.misPedidos(mozo);
    expect(res.pedidos[0].vouchersPorMedio).toEqual([{ medio: 'YAPE', monto: 25, subido: true, voucherId: '5' }]);
    expect(res.pedidos[1].vouchersPorMedio).toEqual([{ medio: 'YAPE', monto: 25, subido: false, voucherId: null }]);
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
      clienteNombre: 'Mesa 3',
      total: 5,
      pagoEstado: 'PENDIENTE',
      pagoMetodo: null,
      plan: [],
      montoDigital: 0,
      vouchers: 0,
      historialVouchers: 0,
      tieneVoucherLegible: false,
      puedeCambiarVoucher: true,
      puedeSubirVoucher: true,
      vouchersPorMedio: [],
      creadoEn: new Date('2026-10-29T14:00:00Z'),
      lineas: [{ nombre: 'Café', cantidad: 2 }],
      progreso: {
        etapa: 'EN_CAMINO',
        etiqueta: 'En camino',
        areas: [],
        listasDe: 0,
        totalAreas: 0,
        porcentaje: 100,
        enCamino: true,
      },
    });
  });

  it('progreso: áreas de cocina con su estado y líneas, sin datos de cocina internos', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({
        id: 6n,
        estado: 'PREPARANDO',
        modalidad: 'MESA',
        lineas: [
          { nombre: 'Limonada', cantidad: 1, area_id: 1n, producto: null },
          { nombre: 'Lomo', cantidad: 1, area_id: null, producto: { categoria: { area_id: 2n } } },
        ],
        comandas: [
          { area_id: 1n, estado: 'DESPEJADA', llego_en: new Date(), despejada_en: new Date(), area: { nombre: 'Bebidas' } },
          { area_id: 2n, estado: 'EN_COCINA', llego_en: new Date(), despejada_en: null, area: { nombre: 'Salados' } },
        ],
      }),
    ]);

    const res = await service.misPedidos(mozo);

    expect(res.pedidos[0].progreso).toEqual({
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Bebidas, faltan Salados',
      areas: [
        { nombre: 'Bebidas', estado: 'LISTA', lineas: 1, productos: [{ nombre: 'Limonada', cantidad: 1 }] },
        { nombre: 'Salados', estado: 'PREPARANDO', lineas: 1, productos: [{ nombre: 'Lomo', cantidad: 1 }] },
      ],
      listasDe: 1,
      totalAreas: 2,
      porcentaje: 50,
      enCamino: false,
    });
    const json = JSON.stringify(res);
    expect(json).not.toContain('llego_en');
    expect(json).not.toContain('despejada');
  });

  it('pide las áreas de cocina y las líneas por área en la misma consulta', async () => {
    await service.misPedidos(mozo);

    const select = prisma.pedido.findMany.mock.calls[0][0].select;
    expect(select.comandas).toEqual({ select: { area_id: true, estado: true, area: { select: { nombre: true } } } });
    expect(select.lineas.select.producto).toEqual({ select: { categoria: { select: { area_id: true } } } });
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
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

  it('clienteNombre: el nombre del cliente; en mesa sin nombre, la mesa; nunca teléfono ni DNI', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedido({ id: 1n, codigo: 'CP-W021', modalidad: 'LLEVAR', mesa_nombre: null, cliente_nombre: 'Ana López', cliente_telefono: '999888777' }),
      pedido({ id: 2n, codigo: 'CP-M002', modalidad: 'MESA', mesa_nombre: 'Mesa 3', cliente_nombre: null, cliente_telefono: '999000111' }),
      pedido({ id: 3n, codigo: 'CP-W003', modalidad: 'LLEVAR', mesa_nombre: null, cliente_nombre: null, cliente_telefono: '988777666' }),
    ]);
    const res = await service.misPedidos(mozo, 'hoy');
    expect(res.pedidos.map((p) => p.clienteNombre)).toEqual(['Ana López', 'Mesa 3', null]);
    expect(JSON.stringify(res)).not.toMatch(/999888777|999000111|988777666/);
  });

  it('pide los vouchers del pedido solo con su semáforo', async () => {
    await service.misPedidos(mozo);

    const select = prisma.pedido.findMany.mock.calls[0][0].select;
    expect(select.pago_metodo).toBe(true);
    expect(select.vouchers).toEqual({ select: { id: true, semaforo: true, medio: true, reemplazado_en: true } });
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
