import { Logger } from '@nestjs/common';
import { controlAlmacenActivo } from './control-almacen';

describe('controlAlmacenActivo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('«si» lo enciende; «no» o sin parámetro lo deja apagado', async () => {
    expect(await controlAlmacenActivo({ parametro: { findUnique: async () => ({ valor: 'si' }) } })).toBe(true);
    expect(await controlAlmacenActivo({ parametro: { findUnique: async () => ({ valor: 'no' }) } })).toBe(false);
    expect(await controlAlmacenActivo({ parametro: { findUnique: async () => null } })).toBe(false);
  });

  it('si leer el parámetro falla, devuelve apagado y lo registra en el log', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const db = { parametro: { findUnique: async () => { throw new Error('bd caida'); } } };

    expect(await controlAlmacenActivo(db)).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('stock_control_activo'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('bd caida'));
  });
});
