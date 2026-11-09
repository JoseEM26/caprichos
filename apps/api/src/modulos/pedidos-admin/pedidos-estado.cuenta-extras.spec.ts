jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

/** «Cuenta» = pedido original + extras (pedido_origen_id): la lista trae juntos a todos sus miembros. */
describe('PedidosEstadoService.listar: cuentas (original + extras)', () => {
  const cajero = { partyId: 5n, rol: 'CAJERO', debeCambiar: false } as any;
  const base = (id: bigint, extra: Record<string, unknown> = {}) => ({
    id,
    codigo: `CP-W${id}`,
    creado_en: new Date('2026-10-29T15:00:00Z'),
    estado: 'PREPARANDO',
    pago_estado: 'PAGADO',
    total: 10,
    lineas: [],
    cobros: [],
    pedido_origen_id: null,
    pedidoOrigen: null,
    extras: [],
    ...extra,
  });
  let prisma: any;
  let service: PedidosEstadoService;

  const montar = (pagina: any[], resto: any[] = []) => {
    prisma = {
      pedido: {
        count: jest.fn().mockResolvedValue(pagina.length),
        findMany: jest.fn().mockResolvedValueOnce(pagina).mockResolvedValueOnce(resto),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma, {} as any, {} as any);
  };

  it('si la página parte la cuenta, el original y los demás extras viajan en `relacionados` (no en items ni en total)', async () => {
    const extra = base(21n, { pedido_origen_id: 20n, pedidoOrigen: { id: 20n, codigo: 'CP-W20' } });
    const original = base(20n, { extras: [{ id: 21n, codigo: 'CP-W21', estado: 'PREPARANDO', pago_estado: 'PAGADO', total: 10 }, { id: 22n, codigo: 'CP-W22', estado: 'COLA', pago_estado: 'PENDIENTE', total: 4 }] });
    const otroExtra = base(22n, { pedido_origen_id: 20n, pedidoOrigen: { id: 20n, codigo: 'CP-W20' } });
    montar([extra], [original, otroExtra]);

    const r: any = await service.listar({ limite: 100 }, cajero);

    expect(r.items.map((p: any) => String(p.id))).toEqual(['21']);
    expect(r.relacionados.map((p: any) => String(p.id))).toEqual(['20', '22']);
    expect(r.total).toBe(1); // la paginación y el resumen no cambian
    // La segunda consulta busca por la raíz y excluye lo que ya vino en la página
    const donde = prisma.pedido.findMany.mock.calls[1][0].where;
    expect(donde.id.notIn).toEqual([21n]);
    expect(donde.OR).toEqual([{ id: { in: [20n] } }, { pedido_origen_id: { in: [20n] } }]);
    // El enlace sale en cada miembro
    expect(r.items[0].pedido_origen).toEqual({ id: '20', codigo: 'CP-W20' });
    expect(r.relacionados[0].extras.map((e: any) => e.codigo)).toEqual(['CP-W21', 'CP-W22']);
  });

  it('si la cuenta cabe completa en la página no hay segunda consulta', async () => {
    const extra = base(21n, { pedido_origen_id: 20n, pedidoOrigen: { id: 20n, codigo: 'CP-W20' } });
    const original = base(20n, { extras: [{ id: 21n, codigo: 'CP-W21', estado: 'PREPARANDO', pago_estado: 'PAGADO', total: 10 }] });
    montar([extra, original]);
    const r: any = await service.listar({ limite: 100 }, cajero);
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
    expect(r.relacionados).toEqual([]);
  });

  it('un pedido sin extras ni original no dispara la consulta de relacionados', async () => {
    montar([base(5n)]);
    const r: any = await service.listar({ limite: 100 }, cajero);
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
    expect(r.relacionados).toEqual([]);
  });

  it('un repartidor no recibe pedidos ajenos como relacionados', async () => {
    const extra = base(21n, { pedido_origen_id: 20n, pedidoOrigen: { id: 20n, codigo: 'CP-W20' } });
    montar([extra], [base(20n)]);
    const r: any = await service.listar({ limite: 100 }, { partyId: 9n, rol: 'REPARTIDOR' } as any);
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1);
    expect(r.relacionados).toEqual([]);
  });
});

describe('PedidosEstadoService.misPedidos: enlace del extra', () => {
  it('devuelve pedidoOrigenId y pedidoOrigenCodigo (null en un pedido normal)', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    const fila = (id: bigint, extra: Record<string, unknown> = {}) => ({
      id, codigo: `CP-M${id}`, estado: 'COLA', modalidad: 'MESA', mesa_nombre: 'Mesa 3', total: '10', pago_estado: 'PENDIENTE', pago_metodo: null,
      creado_en: new Date('2026-10-29T14:00:00Z'), lineas: [], vouchers: [], planPago: [], cliente_nombre: null, pedido_origen_id: null, pedidoOrigen: null, ...extra,
    });
    const prisma = { pedido: { findMany: jest.fn().mockResolvedValue([fila(2n, { pedido_origen_id: 1n, pedidoOrigen: { codigo: 'CP-M1' } }), fila(1n)]) } };
    const service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
    const res = await service.misPedidos({ partyId: 7n, rol: 'MOZO', debeCambiar: false } as any);
    expect(res.pedidos[0]).toMatchObject({ pedidoOrigenId: '1', pedidoOrigenCodigo: 'CP-M1' });
    expect(res.pedidos[1]).toMatchObject({ pedidoOrigenId: null, pedidoOrigenCodigo: null });
    expect(prisma.pedido.findMany.mock.calls[0][0].select.pedido_origen_id).toBe(true);
    jest.useRealTimers();
  });
});
