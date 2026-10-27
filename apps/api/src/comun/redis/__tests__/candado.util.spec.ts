import {
  adquirirCandado,
  liberarCandado,
  ejecutarConCandado,
  SCRIPT_LIBERAR_CANDADO,
} from '../candado.util';

describe('candado.util - Bloqueo distribuido en Redis', () => {
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(),
      eval: jest.fn(),
    };
  });

  describe('adquirirCandado', () => {
    it('toma el candado exitosamente cuando Redis responde OK', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const res = await adquirirCandado(mockRedis, 'lock:prueba', 10000, 'token-123');
      expect(res.adquirido).toBe(true);
      expect(res.fallback).toBe(false);
      expect(res.token).toBe('token-123');
      expect(mockRedis.set).toHaveBeenCalledWith('lock:prueba', 'token-123', 'PX', 10000, 'NX');
    });

    it('no toma el candado cuando otra instancia lo tiene (Redis responde null)', async () => {
      mockRedis.set.mockResolvedValue(null);

      const res = await adquirirCandado(mockRedis, 'lock:prueba', 10000);
      expect(res.adquirido).toBe(false);
      expect(res.fallback).toBe(false);
    });

    it('ejecuta por fallback si Redis está caído o arroja error', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await adquirirCandado(mockRedis, 'lock:prueba', 10000);
      expect(res.adquirido).toBe(true);
      expect(res.fallback).toBe(true);
    });

    it('ejecuta por fallback si no se proporciona instancia de Redis', async () => {
      const res = await adquirirCandado(null, 'lock:prueba', 10000);
      expect(res.adquirido).toBe(true);
      expect(res.fallback).toBe(true);
    });
  });

  describe('liberarCandado', () => {
    it('libera el candado exitosamente si el token coincide', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const liberado = await liberarCandado(mockRedis, 'lock:prueba', 'token-123');
      expect(liberado).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        SCRIPT_LIBERAR_CANDADO,
        1,
        'lock:prueba',
        'token-123',
      );
    });

    it('no libera el candado si el token ya no coincide (retorna 0 en script Lua)', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const liberado = await liberarCandado(mockRedis, 'lock:prueba', 'token-expirado');
      expect(liberado).toBe(false);
    });

    it('maneja errores de Redis sin lanzar excepción', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis timeout'));

      const liberado = await liberarCandado(mockRedis, 'lock:prueba', 'token-123');
      expect(liberado).toBe(false);
    });

    it('retorna false si redis o token no están definidos', async () => {
      expect(await liberarCandado(null, 'lock:prueba', 'token')).toBe(false);
      expect(await liberarCandado(mockRedis, 'lock:prueba', '')).toBe(false);
    });
  });

  describe('ejecutarConCandado', () => {
    it('toma candado, ejecuta la acción y libera solo con su token propio', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const accion = jest.fn().mockResolvedValue('resultado-exitoso');

      const res = await ejecutarConCandado(mockRedis, 'lock:tarea', accion, {
        ttlMs: 5000,
        token: 'token-fijo',
      });

      expect(res.ejecutado).toBe(true);
      expect(res.fallback).toBe(false);
      expect(res.resultado).toBe('resultado-exitoso');
      expect(accion).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith('lock:tarea', 'token-fijo', 'PX', 5000, 'NX');
      expect(mockRedis.eval).toHaveBeenCalledWith(
        SCRIPT_LIBERAR_CANDADO,
        1,
        'lock:tarea',
        'token-fijo',
      );
    });

    it('no toma el candado ni ejecuta la acción si otra réplica lo adquirió', async () => {
      mockRedis.set.mockResolvedValue(null);

      const accion = jest.fn().mockResolvedValue('no-debe-ejecutar');

      const res = await ejecutarConCandado(mockRedis, 'lock:tarea', accion);

      expect(res.ejecutado).toBe(false);
      expect(res.razon).toBe('bloqueado');
      expect(accion).not.toHaveBeenCalled();
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it('ejecuta igual si Redis está caído (fallback de resiliencia sin perder tarea)', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection lost'));

      const accion = jest.fn().mockResolvedValue('ejecutado-por-resiliencia');

      const res = await ejecutarConCandado(mockRedis, 'lock:tarea', accion);

      expect(res.ejecutado).toBe(true);
      expect(res.fallback).toBe(true);
      expect(res.resultado).toBe('ejecutado-por-resiliencia');
      expect(accion).toHaveBeenCalledTimes(1);
      // En modo fallback por Redis caído, no intenta liberar
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it('libera el candado en el bloque finally incluso si la acción falla', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const accion = jest.fn().mockRejectedValue(new Error('Fallo interno de la tarea'));

      await expect(
        ejecutarConCandado(mockRedis, 'lock:tarea', accion, { token: 'token-error' }),
      ).rejects.toThrow('Fallo interno de la tarea');

      expect(mockRedis.eval).toHaveBeenCalledWith(
        SCRIPT_LIBERAR_CANDADO,
        1,
        'lock:tarea',
        'token-error',
      );
    });
  });
});
