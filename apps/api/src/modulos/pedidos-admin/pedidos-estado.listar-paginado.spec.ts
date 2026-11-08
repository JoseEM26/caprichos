jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';

describe('PedidosEstadoService.listar: día completo paginado y resumen', () => {
  const cajero = { partyId: 5n, rol: 'CAJERO', debeCambiar: false } as any;
  // 250 pedidos del día de Lima (29/10); el 1.º es el más reciente. Cruzan la medianoche UTC (00:00 UTC = 19:00 Lima)
  const todos = Array.from({ length: 250 }, (_, i) => ({
    id: BigInt(250 - i),
    creado_en: new Date(Date.UTC(2026, 9, 30, 4, 59) - i * 60000),
    estado: i % 10 === 0 ? 'ANULADO' : 'ENTREGADO',
    pago_estado: 'PAGADO',
    total: 10,
    lineas: [],
    cobros: [],
  }));
  let prisma: any;
  let service: PedidosEstadoService;

  beforeEach(() => {
    prisma = {
      pedido: {
        count: jest.fn().mockResolvedValue(todos.length),
        findMany: jest.fn(async ({ skip, take }: any) => todos.slice(skip, skip + take)),
        groupBy: jest.fn().mockResolvedValue([
          { estado: 'ENTREGADO', pago_estado: 'PAGADO', _count: { _all: 225 }, _sum: { total: 2250 } },
          { estado: 'ANULADO', pago_estado: 'PAGADO', _count: { _all: 25 }, _sum: { total: 250 } },
        ]),
      },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma, {} as any, {} as any);
  });

  it('las páginas de 100 recorren el día sin perder ni repetir pedidos', async () => {
    const vistos: string[] = [];
    for (const pagina of [1, 2, 3]) {
      const r = await service.listar({ desde: '2026-10-29', hasta: '2026-10-29', limite: 100, pagina }, cajero);
      expect(r.total).toBe(250);
      vistos.push(...r.items.map((p: any) => String(p.id)));
    }
    expect(vistos).toHaveLength(250);
    expect(new Set(vistos).size).toBe(250);
  });

  it('ordena por creado_en y desempata por id; el día es el de Lima aunque cruce la medianoche UTC', async () => {
    await service.listar({ desde: '2026-10-29', hasta: '2026-10-29', limite: 100 }, cajero);
    const args = prisma.pedido.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ creado_en: 'desc' }, { id: 'desc' }]);
    expect(args.where.creado_en).toEqual({ gte: new Date('2026-10-29T05:00:00Z'), lt: new Date('2026-10-30T05:00:00Z') });
  });

  it('no filtra por estado: entran activos, entregados, anulados y rechazados', async () => {
    await service.listar({ desde: '2026-10-29', hasta: '2026-10-29', limite: 100 }, cajero);
    expect(prisma.pedido.findMany.mock.calls[0][0].where.estado).toBeUndefined();
  });

  it('resumen=1 agrega el conteo por estado y cobro en una sola consulta agrupada', async () => {
    const r: any = await service.listar({ desde: '2026-10-29', hasta: '2026-10-29', limite: 100, resumen: '1' }, cajero);
    expect(prisma.pedido.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.pedido.groupBy.mock.calls[0][0].by).toEqual(['estado', 'pago_estado']);
    expect(r.resumen).toEqual([
      { estado: 'ENTREGADO', pago_estado: 'PAGADO', n: 225, total: 2250 },
      { estado: 'ANULADO', pago_estado: 'PAGADO', n: 25, total: 250 },
    ]);
  });

  it('sin resumen=1 no hay consulta agrupada ni campo resumen', async () => {
    const r: any = await service.listar({ limite: 100 }, cajero);
    expect(prisma.pedido.groupBy).not.toHaveBeenCalled();
    expect(r.resumen).toBeUndefined();
  });

  it('un repartidor sigue viendo solo lo suyo', async () => {
    await service.listar({ limite: 100 }, { partyId: 9n, rol: 'REPARTIDOR' } as any);
    expect(prisma.pedido.findMany.mock.calls[0][0].where.repartidor_party_id).toBe(9n);
  });

  describe('DTO', () => {
    const validar = (o: object) => validate(plainToInstance(FiltrarPedidosDto, o));
    it('acepta pagina y limite en texto (query string) y los convierte a número', async () => {
      const dto = plainToInstance(FiltrarPedidosDto, { pagina: '2', limite: '100', resumen: '1' });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.pagina).toBe(2);
      expect(dto.limite).toBe(100);
    });
    it('rechaza limite fuera de 1–100, pagina 0, no enteros y resumen distinto de 1', async () => {
      expect(await validar({ limite: '101' })).not.toHaveLength(0);
      expect(await validar({ limite: '0' })).not.toHaveLength(0);
      expect(await validar({ pagina: '0' })).not.toHaveLength(0);
      expect(await validar({ pagina: 'abc' })).not.toHaveLength(0);
      expect(await validar({ resumen: 'si' })).not.toHaveLength(0);
    });
  });
});
