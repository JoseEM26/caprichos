jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any;

describe('anular un pedido con repartidor sincroniza su ruta', () => {
  const pedido = { id: 20n, codigo: 'CP-W020', modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: 10n, entrega_lat: -12, entrega_lng: -77, zona_id: 1n };
  const montar = (rutaFindFirst: jest.Mock) => {
    const prisma: any = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido), update: jest.fn().mockResolvedValue({ ...pedido, estado: 'ANULADO' }), count: jest.fn().mockResolvedValue(0) },
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      pedidoEstadoHistorial: { create: jest.fn() },
      rutaReparto: { findFirst: rutaFindFirst, update: jest.fn(), delete: jest.fn() },
    };
    const eventos: any = { emitirAdmin: jest.fn() };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { prisma, eventos, service: new PedidosEstadoService(prisma, {} as any, auditoria, eventos) };
  };

  it('anula, cierra la ruta si no quedan pendientes y avisa a Repartos', async () => {
    const { prisma, eventos, service } = montar(jest.fn().mockResolvedValue({ id: 7n }));
    prisma.pedido.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2); // pendientes 0, total 2
    const r = await service.cambiarEstado(20n, { estado: 'ANULADO', motivo: 'Cliente desistió' }, admin);
    expect(r.estado).toBe('ANULADO');
    expect(prisma.rutaReparto.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'TERMINADA' }) }));
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('reparto:rutas', {});
  });

  it('si sincronizar la ruta falla, la anulación igual termina', async () => {
    const { service, eventos } = montar(jest.fn().mockRejectedValue(new Error('BD caída')));
    const r = await service.cambiarEstado(20n, { estado: 'ANULADO', motivo: 'Cliente desistió' }, admin);
    expect(r.estado).toBe('ANULADO');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:estado', expect.objectContaining({ estado: 'ANULADO' }));
  });

  // Investigación del «debo cancelar el otro»: el único candidato (ORDEN_RUTA) se quitó en v0.4.92; marcar LISTO nunca mira otros pedidos.
  it('pasar un delivery a LISTO no consulta ni exige resolver otros pedidos (de la ruta o del cliente)', async () => {
    const { prisma, service } = montar(jest.fn());
    const preparando = { ...pedido, estado: 'PREPARANDO', repartidor_party_id: null };
    prisma.pedido.findUnique.mockResolvedValue(preparando);
    prisma.pedido.update.mockResolvedValue({ ...preparando, estado: 'LISTO' });
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    prisma.pedido.findMany = jest.fn();
    prisma.pedido.findFirst = jest.fn();
    const r = await service.cambiarEstado(20n, { estado: 'LISTO' }, admin);
    expect(r.estado).toBe('LISTO');
    expect(prisma.pedido.count).not.toHaveBeenCalled();
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
    expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
  });
});
