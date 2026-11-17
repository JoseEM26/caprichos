// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que los otros specs del servicio)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';
import { SIN_ABANDONADOS_EN_LINEA } from '../../comun/pago-online-pendiente';

describe('PedidosEstadoService.listar: filtro de días en hora de Lima', () => {
  let prisma: any;
  let service: PedidosEstadoService;
  const cajero = { partyId: 5n, rol: 'CAJERO', debeCambiar: false };

  beforeEach(() => {
    // Hoy es 29/10/2026 a las 10:00 en Lima (15:00 UTC): el día Lima empieza a las 05:00 UTC
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    prisma = {
      pedido: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const whereListado = () => prisma.pedido.findMany.mock.calls[0][0].where;

  it('desde y hasta con fecha sola cubren el día de Lima completo (hasta inclusivo)', async () => {
    await service.listar({ desde: '2026-10-29', hasta: '2026-10-29' }, cajero);

    expect(whereListado().AND[0].OR[0].creado_en).toEqual({
      gte: new Date('2026-10-29T05:00:00Z'),
      lt: new Date('2026-10-30T05:00:00Z'),
    });
  });

  it('un rango de varios días llega hasta el fin del último día de Lima', async () => {
    await service.listar({ desde: '2026-10-22', hasta: '2026-10-28' }, cajero);

    expect(whereListado().AND[0].OR[0].creado_en).toEqual({
      gte: new Date('2026-10-22T05:00:00Z'),
      lt: new Date('2026-10-29T05:00:00Z'),
    });
  });

  it('con fecha y hora completas se usa la fecha tal cual (compatibilidad)', async () => {
    await service.listar({ desde: '2026-10-28T10:00:00Z', hasta: '2026-10-28T12:00:00Z' }, cajero);

    expect(whereListado().AND[0].OR[0].creado_en).toEqual({
      gte: new Date('2026-10-28T10:00:00Z'),
      lte: new Date('2026-10-28T12:00:00Z'),
    });
  });

  it('pendientes=1 trae solo días anteriores en curso o con pago pendiente, sin desde/hasta', async () => {
    await service.listar({ pendientes: '1', desde: '2026-10-29', hasta: '2026-10-29' }, cajero);

    const where = whereListado();
    expect(where.creado_en).toEqual({ lt: new Date('2026-10-29T05:00:00Z') });
    expect(where.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO', 'PROGRAMADO'] });
    expect(where.AND).toEqual([
      {
        OR: [
          { estado: { in: ['COLA', 'NUEVO', 'PREPARANDO', 'PREP', 'LISTO', 'EN_CAMINO', 'RUTA'] } },
          { pago_estado: { in: ['PENDIENTE', 'COORDINADO'] } },
        ],
      },
      // Pagos en línea que nunca se pagaron no entran a Caja (se agrega siempre, después de los filtros de día)
      SIN_ABANDONADOS_EN_LINEA,
    ]);
  });
});

/** Programados: visibles en todos los filtros de días hasta su entrega; modo «Programados / encargos». */
describe('PedidosEstadoService.listar: programados por día de entrega', () => {
  // Evalúa solo lo que usa el filtro: AND, OR, igualdad, in/notIn y rangos de fecha
  const cumple = (fila: any, where: any): boolean => {
    if (Array.isArray(where)) return where.every((w) => cumple(fila, w));
    return Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'AND') return cumple(fila, v);
      if (k === 'NOT') return !cumple(fila, v);
      if (k === 'OR') return v.some((w: any) => cumple(fila, w));
      if (v && typeof v === 'object' && ('gte' in v || 'lt' in v || 'lte' in v)) {
        const t = fila[k]?.getTime?.();
        if (t === undefined) return false;
        return (!v.gte || t >= v.gte.getTime()) && (!v.lt || t < v.lt.getTime()) && (!v.lte || t <= v.lte.getTime());
      }
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(fila[k]);
      if (v && typeof v === 'object' && 'notIn' in v) return !v.notIn.includes(fila[k]);
      if (v && typeof v === 'object' && 'contains' in v) return String(fila[k] ?? '').toUpperCase().includes(String(v.contains).toUpperCase());
      return fila[k] === v;
    });
  };
  const fila = (id: bigint, creado: string, programado: string | null, estado = 'PROGRAMADO') => ({
    id, codigo: `CP-${id}`, creado_en: new Date(creado), programado_para: programado ? new Date(programado) : null,
    estado, pago_estado: 'PAGADO', total: 29, cliente_nombre: null, cliente_telefono: null, mesa_nombre: null,
    lineas: [], cobros: [], pedido_origen_id: null, pedidoOrigen: null, extras: [],
  });
  // Hoy es 29/10/2026 (Lima)
  const filas = [
    fila(1n, '2026-10-29T14:00:00Z', null, 'PREPARANDO'), // creado hoy, sin programa
    fila(2n, '2026-10-28T22:00:00Z', '2026-10-29T22:00:00Z'), // creado ayer para HOY
    fila(3n, '2026-10-28T22:00:00Z', '2026-10-30T22:00:00Z'), // creado ayer para MAÑANA
    fila(4n, '2026-10-29T14:00:00Z', '2026-10-30T22:00:00Z'), // creado hoy para MAÑANA
    fila(5n, '2026-10-27T22:00:00Z', '2026-10-29T23:00:00Z', 'COLA'), // creado antier para hoy, ya en cola
    fila(6n, '2026-10-27T22:00:00Z', '2026-10-28T22:00:00Z', 'ENTREGADO'), // entregado ayer
  ];
  let prisma: any;
  let service: PedidosEstadoService;
  const cajero = { partyId: 5n, rol: 'CAJERO', debeCambiar: false };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    prisma = {
      pedido: {
        count: jest.fn(async ({ where }: any) => filas.filter((f) => cumple(f, where)).length),
        findMany: jest.fn(async ({ where }: any) => filas.filter((f) => cumple(f, where))),
        groupBy: jest.fn(),
      },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const ids = (r: any) => r.items.map((i: any) => Number(i.id)).sort((a: number, b: number) => a - b);
  const dia = (d: string) => ({ desde: d, hasta: d });

  it('un programado creado ayer para hoy aparece en la lista de hoy', async () => {
    const r: any = await service.listar(dia('2026-10-29'), cajero);
    expect(ids(r)).toContain(2);
  });

  it('un programado para mañana sale también hoy (la web lo muestra aparte, no cuenta en el día)', async () => {
    const r: any = await service.listar(dia('2026-10-29'), cajero);
    expect(ids(r)).toContain(3);
    const otroDia = r.items.find((i: any) => Number(i.id) === 3);
    expect(otroDia.programado_para).toEqual(new Date('2026-10-30T22:00:00Z'));
  });

  it('con el filtro de ayer el programado de hoy sigue visible', async () => {
    const r: any = await service.listar(dia('2026-10-28'), cajero);
    expect(ids(r)).toEqual([2, 3, 6]);
  });

  it('el día de entrega suma el pedido de ayer al día de hoy, y deja de verse fuera de su día al entregarlo', async () => {
    const r: any = await service.listar(dia('2026-10-29'), cajero);
    expect(ids(r)).toEqual([1, 2, 3, 4, 5]); // 5: entregable hoy (COLA); 6: entregado ayer, fuera de hoy
  });

  it('no hay duplicados: cada pedido sale una vez aunque cumpla varias condiciones', async () => {
    const r: any = await service.listar(dia('2026-10-29'), cajero);
    expect(new Set(ids(r)).size).toBe(ids(r).length);
    expect(r.total).toBe(5);
  });

  it('modo «Programados / encargos»: solo PROGRAMADO desde hoy, por fecha de entrega ascendente', async () => {
    const r: any = await service.listar({ programados: '1' }, cajero);
    expect(ids(r)).toEqual([2, 3, 4]);
    expect(prisma.pedido.findMany.mock.calls[0][0].orderBy).toEqual([{ programado_para: 'asc' }, { id: 'asc' }]);
  });

  it('modo «Programados / encargos» con fecha de entrega filtra por el día pactado', async () => {
    const r: any = await service.listar({ programados: '1', entregaDesde: '2026-10-30', entregaHasta: '2026-10-30' }, cajero);
    expect(ids(r)).toEqual([3, 4]);
  });

  it('el filtro de estado sigue aplicando sobre los programados', async () => {
    const r: any = await service.listar({ ...dia('2026-10-29'), estado: 'PROGRAMADO' }, cajero);
    expect(ids(r)).toEqual([2, 3, 4]);
    const r2: any = await service.listar({ ...dia('2026-10-29'), estado: 'COLA' }, cajero);
    expect(ids(r2)).toEqual([5]);
  });

  it('el resumen del día no cuenta programados para un día posterior', async () => {
    await service.listar({ ...dia('2026-10-29'), resumen: '1' }, cajero);
    const where = prisma.pedido.groupBy.mock.calls[0][0].where;
    expect(where.AND.at(-1)).toEqual({ NOT: { estado: 'PROGRAMADO', programado_para: { gte: new Date('2026-10-30T05:00:00Z') } } });
  });

  it('buscar convive con el rango de días y con los programados (AND, no pisa el OR de búsqueda)', async () => {
    const r: any = await service.listar({ ...dia('2026-10-29'), buscar: 'CP-3' }, cajero);
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ codigo: { contains: 'CP-3', mode: 'insensitive' } });
    expect(where.AND[0].OR).toHaveLength(3);
    expect(ids(r)).toEqual([3]);
  });
});
