jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { PedidosProgramadosService } from './pedidos-programados.service';

describe('PedidosProgramadosService.pasarACola', () => {
  const armar = (debidos: any[], countUpdate = 1) => {
    const tx: any = {
      pedido: { updateMany: jest.fn().mockResolvedValue({ count: countUpdate }) },
      pedidoEstadoHistorial: { create: jest.fn() },
    };
    const prisma: any = {
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue(debidos) },
      $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    };
    const eventos = { emitirAdmin: jest.fn() };
    const impresion = { encolarEtiquetasPedido: jest.fn() };
    return { tx, prisma, eventos, impresion, svc: new PedidosProgramadosService(prisma, { registrar: jest.fn() } as any, eventos as any, impresion as any) };
  };

  it('busca solo los PROGRAMADO cuya hora menos 30 min ya llegó y los pasa a COLA con pasa_cocina_en', async () => {
    const { svc, prisma, tx, eventos, impresion } = armar([{ id: 1n, codigo: 'CP-W001' }]);
    const ahora = new Date('2026-11-14T12:30:00.000Z');
    const pasados = await svc.pasarACola(ahora);
    expect(pasados).toEqual(['CP-W001']);
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.estado).toBe('PROGRAMADO');
    expect(where.programado_para.lte).toEqual(new Date('2026-11-14T13:00:00.000Z'));
    expect(tx.pedido.updateMany).toHaveBeenCalledWith({ where: { id: 1n, estado: 'PROGRAMADO' }, data: { estado: 'COLA', pasa_cocina_en: ahora } });
    expect(tx.pedidoEstadoHistorial.create.mock.calls[0][0].data).toMatchObject({ estado_anterior: 'PROGRAMADO', estado_nuevo: 'COLA' });
    expect(impresion.encolarEtiquetasPedido).toHaveBeenCalledWith('1');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:nuevo', expect.objectContaining({ estado: 'COLA' }));
  });

  it('es idempotente: si otro ciclo ya lo pasó (count 0) no repite historial ni avisos', async () => {
    const { svc, tx, eventos, impresion } = armar([{ id: 1n, codigo: 'CP-W001' }], 0);
    expect(await svc.pasarACola(new Date())).toEqual([]);
    expect(tx.pedidoEstadoHistorial.create).not.toHaveBeenCalled();
    expect(eventos.emitirAdmin).not.toHaveBeenCalled();
    expect(impresion.encolarEtiquetasPedido).not.toHaveBeenCalled();
  });

  it('sin pedidos debidos no hace nada', async () => {
    const { svc, prisma } = armar([]);
    expect(await svc.pasarACola(new Date())).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
