jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

describe('PedidosEstadoService.misPedidos: alcance, rangos, orden y progreso', () => {
  let prisma: any;
  let service: PedidosEstadoService;
  const mozo = { partyId: 7n, rol: 'MOZO', debeCambiar: false } as any;
  const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any;
  const supervisor = { partyId: 2n, rol: 'SUPERVISOR', debeCambiar: false } as any;

  const pedido = (extra: Record<string, unknown>) => ({
    id: 1n,
    codigo: 'CP-M001',
    estado: 'COLA',
    modalidad: 'MESA',
    mesa_nombre: 'Mesa 3',
    total: '10',
    pago_estado: 'PENDIENTE',
    pago_metodo: null,
    party_id: 7n,
    creado_en: new Date('2026-10-29T14:00:00Z'),
    pasa_cocina_en: null,
    lineas: [],
    comandas: [],
    vouchers: [],
    planPago: [],
    cliente_nombre: null,
    ...extra,
  });
  const where = () => prisma.pedido.findMany.mock.calls[0][0].where;

  beforeEach(() => {
    // 29/10/2026 10:00 Lima = 15:00 UTC
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    prisma = {
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { party_id: 7n, _count: { _all: 3 } },
          { party_id: 8n, _count: { _all: 1 } },
        ]),
      },
      person: {
        findMany: jest.fn().mockResolvedValue([
          { party_id: 7n, nombres: 'Rosa', apellidos: 'Paz' },
          { party_id: 8n, nombres: 'Ana', apellidos: null },
        ]),
      },
    };
    service = new PedidosEstadoService(prisma, {} as any, {} as any);
  });
  afterEach(() => jest.useRealTimers());

  it('el mozo solo ve los suyos: ignora `mozo` y no recibe la lista de mozos', async () => {
    const res = await service.misPedidos(mozo, 'hoy', { mozo: '8' });
    expect(where().party_id).toBe(7n);
    expect(prisma.pedido.groupBy).not.toHaveBeenCalled();
    expect(res.mozos).toBeUndefined();
  });

  it('admin y supervisor ven todos los mozos (canal MOZO) y reciben el desplegable con nombres', async () => {
    for (const u of [admin, supervisor]) {
      prisma.pedido.findMany.mockClear();
      const res = await service.misPedidos(u, 'hoy');
      expect(where().canal).toBe('MOZO');
      expect(where().party_id).toBeUndefined();
      expect(res.mozos).toEqual([
        { partyId: '8', nombre: 'Ana', pedidos: 1 },
        { partyId: '7', nombre: 'Rosa Paz', pedidos: 3 },
      ]);
    }
  });

  it('admin filtra por mozo y cada pedido trae mozoNombre y mozoPartyId', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([pedido({ party_id: 8n })]);
    const res = await service.misPedidos(admin, 'hoy', { mozo: '8' });
    expect(where().party_id).toBe(8n);
    expect(res.pedidos[0].mozoPartyId).toBe('8');
    expect(res.pedidos[0].mozoNombre).toBe('Ana');
  });

  it('rangos nuevos: 30dias, todas, y desde/hasta (día Lima, inclusivos) mandan sobre rango', async () => {
    await service.misPedidos(admin, '30dias');
    expect(where().creado_en).toEqual({ gte: new Date('2026-09-30T05:00:00Z') });

    prisma.pedido.findMany.mockClear();
    await service.misPedidos(admin, 'todas');
    expect(where().creado_en).toBeUndefined();

    prisma.pedido.findMany.mockClear();
    await service.misPedidos(admin, 'hoy', { desde: '2026-10-01', hasta: '2026-10-03' });
    expect(where().creado_en).toEqual({ gte: new Date('2026-10-01T05:00:00Z'), lt: new Date('2026-10-04T05:00:00Z') });
  });

  it('filtro de estado: EN_CURSO agrupa los activos; uno concreto va exacto', async () => {
    await service.misPedidos(admin, 'hoy', { estado: 'EN_CURSO' });
    expect(where().estado).toEqual({ in: ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'] });
    prisma.pedido.findMany.mockClear();
    await service.misPedidos(admin, 'hoy', { estado: 'ANULADO' });
    expect(where().estado).toBe('ANULADO');
  });

  it('orden mas_espera: el que más espera primero; los LISTO/ENTREGADO al final; esperaMinutos desde pasa_cocina_en', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({ id: 3n, estado: 'ENTREGADO' }),
      pedido({ id: 2n, estado: 'COLA', creado_en: new Date('2026-10-29T14:50:00Z') }), // 10 min
      pedido({ id: 1n, estado: 'PREPARANDO', creado_en: new Date('2026-10-29T14:00:00Z'), pasa_cocina_en: new Date('2026-10-29T14:30:00Z') }), // 30 min
    ]);
    const res = await service.misPedidos(admin, 'hoy', { orden: 'mas_espera' });
    expect(res.pedidos.map((p) => [p.id, p.esperaMinutos])).toEqual([
      ['1', 30],
      ['2', 10],
      ['3', null],
    ]);
  });

  it('progreso: total/listas/porArea por unidades, sin romper la forma existente', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      pedido({
        estado: 'PREPARANDO',
        comandas: [
          { area_id: 1n, estado: 'DESPEJADA', area: { nombre: 'Bebidas' } },
          { area_id: 2n, estado: 'PENDIENTE', area: { nombre: 'Salados' } },
        ],
        lineas: [
          { id: 1n, nombre: 'Limonada', cantidad: 2, listas: 2, area_id: 1n, opcionesElegidas: [], precio_unit: '1' },
          { id: 2n, nombre: 'Lomo', cantidad: 2, listas: 1, area_id: 2n, opcionesElegidas: [], precio_unit: '1' },
        ],
      }),
    ]);
    const { progreso } = (await service.misPedidos(admin)).pedidos[0];
    expect(progreso).toMatchObject({
      total: 4,
      listas: 3,
      porcentajeUnidades: 75,
      porArea: [
        { area: 'Bebidas', total: 2, listas: 2 },
        { area: 'Salados', total: 2, listas: 1 },
      ],
      etapa: 'PARCIAL',
      areas: expect.any(Array),
    });
  });
});
