import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../../comun/api';
import { salonApi } from '../api';

describe('salonApi: pedido con varias mesas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('agregarMesasPedido envía los ids a POST /pedidos/:id/mesas', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, mesa: 'Mesas 3 y 4', mesas: [] } as any);
    await salonApi.agregarMesasPedido('50', ['4']);
    expect(post).toHaveBeenCalledWith('/admin/salon/pedidos/50/mesas', { mesaIds: ['4'] });
  });

  it('quitarMesaPedido hace DELETE a /pedidos/:id/mesas/:mesaId', async () => {
    const del = vi.spyOn(api, 'delete').mockResolvedValue({ ok: true, mesa: 'Mesa 3', mesas: [] } as any);
    await salonApi.quitarMesaPedido('50', '4');
    expect(del).toHaveBeenCalledWith('/admin/salon/pedidos/50/mesas/4');
  });

  it('cambiarMesaPedido sin desdeMesaId manda solo mesaId (compatible) y con él, también el origen', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true, mesa: 'Mesa 5' } as any);
    await salonApi.cambiarMesaPedido('50', '6');
    expect(post).toHaveBeenLastCalledWith('/admin/salon/pedidos/50/cambiar-mesa', { mesaId: '6' });
    await salonApi.cambiarMesaPedido('50', '6', '4');
    expect(post).toHaveBeenLastCalledWith('/admin/salon/pedidos/50/cambiar-mesa', { mesaId: '6', desdeMesaId: '4' });
  });
});
