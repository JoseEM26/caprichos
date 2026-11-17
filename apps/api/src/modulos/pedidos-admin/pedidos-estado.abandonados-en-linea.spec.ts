// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que los otros specs del servicio)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

// Evaluador mínimo de filtros Prisma (solo los operadores que usan el listado y WHERE_ABANDONADO_EN_LINEA),
// para comprobar qué ve Caja sin base de datos. Datos sintéticos.
function cumple(obj: any, w: any): boolean {
  return Object.entries(w).every(([k, v]: [string, any]) => {
    if (k === 'OR') return v.some((x: any) => cumple(obj, x));
    if (k === 'AND') return v.every((x: any) => cumple(obj, x));
    if (k === 'NOT') return !cumple(obj, v);
    const actual = obj[k];
    if (v === null) return actual == null;
    if (v && typeof v === 'object') {
      if ('none' in v) return !(actual as any[]).some((x) => cumple(x, v.none));
      if ('some' in v) return (actual as any[]).some((x) => cumple(x, v.some));
      if ('in' in v) return v.in.includes(actual);
      if ('notIn' in v) return !v.notIn.includes(actual);
      if ('startsWith' in v) return typeof actual === 'string' && actual.startsWith(v.startsWith);
      if ('not' in v) return actual !== v.not;
    }
    return actual === v;
  });
}

const pedidos: any[] = [
  // Pago en línea esperando el pago: no es de Caja
  { id: 1n, codigo: 'CP-A', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', motivo_anulacion: null, cobros: [], pagosOnline: [{ estado: 'CREADO' }] },
  // Pago en línea vencido sin pagar (anulado por tiempo): no es de Caja
  { id: 2n, codigo: 'CP-B', estado: 'ANULADO', pago_estado: 'PENDIENTE_ONLINE', motivo_anulacion: 'Sin pago en línea en 15 minutos', cobros: [], pagosOnline: [{ estado: 'FALLIDO' }] },
  // Pago en línea que sí se pagó y luego se anuló: sigue viéndose
  { id: 3n, codigo: 'CP-C', estado: 'ANULADO', pago_estado: 'PAGADO', motivo_anulacion: 'Cliente cambió de idea', cobros: [{ anulado_en: new Date('2026-11-17T10:00:00Z') }], pagosOnline: [{ estado: 'APROBADO' }] },
  // Pago en línea cobrado y en cola: normal
  { id: 4n, codigo: 'CP-D', estado: 'COLA', pago_estado: 'PAGADO', motivo_anulacion: null, cobros: [{ anulado_en: null }], pagosOnline: [{ estado: 'APROBADO' }] },
  // Anulado en el local, sin pago en línea: normal
  { id: 5n, codigo: 'CP-E', estado: 'ANULADO', pago_estado: 'PENDIENTE', motivo_anulacion: 'Error del mozo', cobros: [], pagosOnline: [] },
  // Venció y pagó tarde con el pedido ya anulado: queda visible para devolver
  { id: 6n, codigo: 'CP-F', estado: 'ANULADO', pago_estado: 'PENDIENTE_ONLINE', motivo_anulacion: 'Sin pago en línea en 15 minutos', cobros: [], pagosOnline: [{ estado: 'APROBADO' }] },
];

describe('Pagos en línea sin completar: fuera de Caja por defecto (sin aparecer en listados, resumen ni cierre)', () => {
  let service: PedidosEstadoService;
  let prisma: any;
  const cajero: any = { partyId: 5n, rol: 'CAJERO', debeCambiar: false };
  const codigos = (r: any) => r.items.map((p: any) => p.codigo).sort();

  beforeEach(() => {
    prisma = {
      pedido: {
        findMany: jest.fn(async ({ where }: any) => pedidos.filter((p) => cumple(p, where)).map((p) => ({ lineas: [], extras: [], ...p }))),
        count: jest.fn(async ({ where }: any) => pedidos.filter((p) => cumple(p, where)).length),
        groupBy: jest.fn(async ({ where }: any) => {
          const filas = pedidos.filter((p) => cumple(p, where));
          return [...new Map(filas.map((p) => [`${p.estado}|${p.pago_estado}`, p])).values()].map((p) => ({
            estado: p.estado, pago_estado: p.pago_estado, _count: { _all: filas.filter((x) => x.estado === p.estado && x.pago_estado === p.pago_estado).length }, _sum: { total: 0 },
          }));
        }),
      },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
  });

  it('por defecto Caja no ve POR_PAGAR ni los vencidos sin pagar; sí ve el pagado y luego anulado', async () => {
    const r = await service.listar({}, cajero);
    expect(codigos(r)).toEqual(['CP-C', 'CP-D', 'CP-E', 'CP-F']);
    expect(r.total).toBe(4);
  });

  it('pedir estado POR_PAGAR explícito tampoco lo muestra por defecto', async () => {
    const r = await service.listar({ estado: 'POR_PAGAR' } as any, cajero);
    expect(r.items).toEqual([]);
  });

  it('el resumen del día y los contadores tampoco cuentan los abandonados', async () => {
    const r = await service.listar({ resumen: '1' } as any, cajero);
    const cuentas = r.resumen!.reduce((t: number, g: any) => t + g.n, 0);
    expect(cuentas).toBe(4);
    expect(r.resumen!.find((g: any) => g.estado === 'POR_PAGAR')).toBeUndefined();
    // El anulado con pago en línea que sí se pagó (CP-F) sigue contado; los vencidos sin pagar (CP-B) no
    expect(r.resumen!.find((g: any) => g.estado === 'ANULADO' && g.pago_estado === 'PENDIENTE_ONLINE')).toMatchObject({ n: 1 });
  });

  it('abandonadosEnLinea=1 (auditoría) devuelve SOLO esperando pago y vencidos sin pagar', async () => {
    const r = await service.listar({ abandonadosEnLinea: '1' } as any, cajero);
    expect(codigos(r)).toEqual(['CP-A', 'CP-B']);
    expect(r.total).toBe(2);
  });

  it('el filtro de auditoría no mete de vuelta pagos de otros estados', async () => {
    const r = await service.listar({ abandonadosEnLinea: '1', estado: 'COLA' } as any, cajero);
    expect(r.items).toEqual([]);
  });

  it('el filtro por defecto es el que exporta comun/pago-online-pendiente (no una copia)', async () => {
    await service.listar({}, cajero);
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([{ NOT: expect.objectContaining({ OR: expect.any(Array) }) }]));
  });
});
