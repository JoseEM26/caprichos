jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { StockService } from './stock.service';

describe('StockService.reaplicarPorPedido (revertir una anulación)', () => {
  const anul = (id: bigint, extra: any) => ({ id, tipo: 'ANULACION', pedido_id: 10n, lugar_id: 1n, cantidad: 2, ...extra });
  function montar(anulaciones: any[], yaReaplicado: string[] = []) {
    const db: any = {
      movimientoStock: {
        findMany: jest.fn().mockResolvedValue(anulaciones),
        findFirst: jest.fn(async ({ where }: any) => (yaReaplicado.includes(where.nota) ? { id: 1n } : null)),
        create: jest.fn(),
      },
      stock: { updateMany: jest.fn() },
      stockSabor: { updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(db)),
    };
    return { db, service: new StockService(db, {} as any) };
  }
  const desde = new Date('2026-11-13T15:00:00Z');

  it('vuelve a descontar insumos, productos y sabores y deja un VENTA por cada anulación', async () => {
    const { db, service } = montar([anul(1n, { insumo_id: 5n }), anul(2n, { producto_id: 6n }), anul(3n, { sabor_id: 7n })]);
    const r = await service.reaplicarPorPedido(10n, desde, 1n);
    expect(r.movimientosReaplicados).toBe(3);
    expect(db.movimientoStock.findMany.mock.calls[0][0].where).toMatchObject({ pedido_id: 10n, tipo: 'ANULACION', en: { gte: desde } });
    expect(db.stock.updateMany).toHaveBeenCalledWith({ where: { insumo_id: 5n, lugar_id: 1n }, data: { cantidad: { decrement: 2 } } });
    expect(db.stock.updateMany).toHaveBeenCalledWith({ where: { producto_id: 6n, lugar_id: 1n }, data: { cantidad: { decrement: 2 } } });
    expect(db.stockSabor.updateMany).toHaveBeenCalledWith({ where: { sabor_id: 7n }, data: { cantidad: { decrement: 2 } } });
    expect(db.movimientoStock.create.mock.calls.map((c: any) => c[0].data)).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: 'VENTA', insumo_id: 5n, nota: 'reversion-anulacion:1' })]),
    );
  });

  it('es idempotente: una anulación ya reaplicada no se descuenta dos veces', async () => {
    const { db, service } = montar([anul(1n, { insumo_id: 5n })], ['reversion-anulacion:1']);
    const r = await service.reaplicarPorPedido(10n, desde);
    expect(r.movimientosReaplicados).toBe(0);
    expect(db.stock.updateMany).not.toHaveBeenCalled();
  });
});
