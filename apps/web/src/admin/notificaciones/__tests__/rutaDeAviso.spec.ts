import { describe, it, expect } from 'vitest';
import { rutaDeAviso } from '../AvisosNotificaciones';

describe('rutaDeAviso', () => {
  it('los avisos viejos de /admin/pedidos llevan a Caja', () => {
    expect(rutaDeAviso({ ruta: '/admin/pedidos', modulo: 'caja' } as any)).toBe('/admin/caja');
    expect(rutaDeAviso({ ruta: '/admin/caja?pedido=7', modulo: 'caja' } as any)).toBe('/admin/caja?pedido=7');
  });
});
