jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';

describe('PedidosEstadoService.listar: medio de pago, limite y columnas', () => {
  let prisma: any;
  let service: PedidosEstadoService;
  const cajero = { partyId: 5n, rol: 'CAJERO', debeCambiar: false } as any;
  const t0 = new Date('2026-11-09T17:00:00Z');
  const fila = (o: any = {}) => ({
    id: 1n, canal: 'MOZO', party_id: 3n, creado_en: t0, estado: 'ENTREGADO', modalidad: 'LOCAL',
    entregado_en: new Date(t0.getTime() + 600000), entregado_mesa_en: null, anulado_en: null,
    pago_estado: 'PAGADO', total: 10, lineas: [], cobros: [], ...o,
  });
  const llamada = () => prisma.pedido.findMany.mock.calls[0][0];

  beforeEach(() => {
    prisma = {
      pedido: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([fila()]) },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 3n, nombres: 'Ana', apellidos: 'Paz' }, { party_id: 5n, nombres: 'Caro', apellidos: null }]) },
    };
    service = new PedidosEstadoService(prisma, {} as any, {} as any);
  });

  it('medios arma cobro vigente con ese medio OR (sin cobro y medio elegido), anulados excluidos', async () => {
    await service.listar({ medios: 'YAPE,PLIN' } as any, cajero);
    const [cond] = llamada().where.AND;
    expect(cond.OR[0]).toEqual({ cobros: { some: { anulado_en: null, pagos: { some: { medio: { in: ['YAPE', 'PLIN'] } } } } } });
    expect(cond.OR[1].cobros).toEqual({ none: { anulado_en: null } });
    expect(cond.OR[1].OR).toEqual(expect.arrayContaining([{ pago_metodo: { contains: 'YAPE' } }, { pago_preferido: { contains: 'PLIN' } }]));
  });

  it('medios convive con pendientes (no pisa su AND)', async () => {
    await service.listar({ medios: 'EFECTIVO', pendientes: '1' } as any, cajero);
    expect(llamada().where.AND).toHaveLength(2);
  });

  it('sin medios no agrega condición', async () => {
    await service.listar({} as any, cajero);
    expect(llamada().where.AND).toBeUndefined();
  });

  it('fila: mediosPago de cobros vigentes (mixto), cobrador, mozo y tiempo total', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      fila({ cobros: [{ id: 9n, en: new Date(t0.getTime() + 300000), cobrado_por: 5n, pagos: [{ medio: 'YAPE' }, { medio: 'EFECTIVO' }, { medio: 'YAPE' }] }] }),
    ]);
    const r: any = await service.listar({} as any, cajero);
    expect(r.items[0]).toMatchObject({
      mediosPago: ['YAPE', 'EFECTIVO'], mediosPagoPendiente: false,
      atendidoPorNombre: 'Ana Paz', cobradoPorNombre: 'Caro', tiempoTotalSeg: 600,
    });
    expect(r.items[0].atendidoEn).toEqual(t0);
  });

  it('sin cobro: medio elegido marcado como pendiente', async () => {
    prisma.pedido.findMany.mockResolvedValue([fila({ pago_preferido: 'PLIN', canal: 'CARTA' })]);
    const r: any = await service.listar({} as any, cajero);
    expect(r.items[0]).toMatchObject({ mediosPago: ['PLIN'], mediosPagoPendiente: true, atendidoPorNombre: null, cobradoEn: null });
  });

  it.each([[10, 10], [25, 25], [50, 50], [100, 100], ['todas', 2000]])('limite %s -> take %s', async (lim, take) => {
    await service.listar({ limite: lim } as any, cajero);
    expect(llamada().take).toBe(take);
  });

  it('estado con varios valores usa in', async () => {
    await service.listar({ estado: 'LISTO,ENTREGADO' } as any, cajero);
    expect(llamada().where.estado).toEqual({ in: ['LISTO', 'ENTREGADO'] });
  });

  it.each([['10', true], ['100', true], ['todas', true], ['101', false], ['0', false], ['mil', false]])('DTO limite %s válido=%s', async (v, ok) => {
    const errs = await validate(plainToInstance(FiltrarPedidosDto, { limite: v }));
    expect(errs.length === 0).toBe(ok);
  });

  it.each([['YAPE', true], ['YAPE,PLIN,TARJETA', true], ['OTRO', false], ['YAPE,', false]])('DTO medios %s válido=%s', async (v, ok) => {
    const errs = await validate(plainToInstance(FiltrarPedidosDto, { medios: v }));
    expect(errs.length === 0).toBe(ok);
  });
});
