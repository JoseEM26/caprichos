jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

/** Un programado (para otro día) no acumula espera: sin pastilla roja ni alerta de tardanza. */
describe('PedidosEstadoService.listar: programado sin tiempo de espera', () => {
  const fila = (id: bigint, estado: string) => ({
    id, codigo: `CP-P${id}`, creado_en: new Date('2026-11-14T15:00:00Z'), estado, pago_estado: 'PAGADO', total: 29,
    programado_para: new Date('2026-11-17T22:00:00Z'), lineas: [], cobros: [], pedido_origen_id: null, pedidoOrigen: null, extras: [],
  });

  it('PROGRAMADO creado hace días sale con 0 min y verde; uno en curso de ese mismo día sí corre', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-16T15:00:00Z') });
    const prisma: any = {
      pedido: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([fila(1n, 'PROGRAMADO'), fila(2n, 'PREPARANDO')]), groupBy: jest.fn() },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PedidosEstadoService(prisma, {} as any, {} as any);
    const r: any = await service.listar({ limite: 100 }, { partyId: 5n, rol: 'CAJERO', debeCambiar: false } as any);
    jest.useRealTimers();
    expect(r.items[0]).toMatchObject({ estado: 'PROGRAMADO', minutosEspera: 0, color: 'verde', colorEspera: 'verde' });
    expect(r.items[0].programado_para).toEqual(new Date('2026-11-17T22:00:00Z'));
    // Programado ya en cocina (PREPARANDO) pero antes de su hora pactada: verde, sin minutos de tardanza
    expect(r.items[1]).toMatchObject({ minutosEspera: 0, color: 'verde' });
  });

  it('pasada la hora pactada, el programado cuenta el retraso desde ella (rojo a los 50 min)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-17T22:50:00Z') });
    const prisma: any = {
      pedido: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([fila(2n, 'PREPARANDO')]), groupBy: jest.fn() },
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoCambioUbicacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PedidosEstadoService(prisma, {} as any, {} as any);
    const r: any = await service.listar({ limite: 100 }, { partyId: 5n, rol: 'CAJERO', debeCambiar: false } as any);
    jest.useRealTimers();
    expect(r.items[0]).toMatchObject({ minutosEspera: 50, color: 'rojo' });
  });
});
