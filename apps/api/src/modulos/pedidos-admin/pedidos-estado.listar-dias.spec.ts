// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que los otros specs del servicio)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

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

    expect(whereListado().creado_en).toEqual({
      gte: new Date('2026-10-29T05:00:00Z'),
      lt: new Date('2026-10-30T05:00:00Z'),
    });
  });

  it('un rango de varios días llega hasta el fin del último día de Lima', async () => {
    await service.listar({ desde: '2026-10-22', hasta: '2026-10-28' }, cajero);

    expect(whereListado().creado_en).toEqual({
      gte: new Date('2026-10-22T05:00:00Z'),
      lt: new Date('2026-10-29T05:00:00Z'),
    });
  });

  it('con fecha y hora completas se usa la fecha tal cual (compatibilidad)', async () => {
    await service.listar({ desde: '2026-10-28T10:00:00Z', hasta: '2026-10-28T12:00:00Z' }, cajero);

    expect(whereListado().creado_en).toEqual({
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
    ]);
  });
});
