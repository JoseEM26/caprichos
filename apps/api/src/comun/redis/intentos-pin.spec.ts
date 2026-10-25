import { HttpStatus } from '@nestjs/common';
import {
  exigirPinNoBloqueado,
  limpiarIntentosPin,
  registrarFalloPin,
  SEGUNDOS_BLOQUEO_PIN,
} from './intentos-pin';

describe('intentos-pin (falla cerrado)', () => {
  const clave = 'pin:supervisor:intentos:1';

  it('sin Redis no se valida ningún PIN: 503 con mensaje claro', async () => {
    const redis: any = { get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };

    await expect(exigirPinNoBloqueado(redis, clave)).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: {
        codigo: 'PIN_NO_DISPONIBLE',
        mensaje: 'No se puede validar el PIN ahora, intenta en unos minutos',
      },
    });
  });

  it('si Redis cae al sumar un fallo o al limpiar, también 503 (no se deja pasar)', async () => {
    const redis: any = {
      incr: jest.fn().mockRejectedValue(new Error('down')),
      del: jest.fn().mockRejectedValue(new Error('down')),
    };

    await expect(registrarFalloPin(redis, clave)).rejects.toMatchObject({ status: 503 });
    await expect(limpiarIntentosPin(redis, clave)).rejects.toMatchObject({ status: 503 });
  });

  it('tres fallos seguidos bloquean 5 minutos (CODIGO_BLOQUEADO 403)', async () => {
    const redis: any = { get: jest.fn().mockResolvedValue('3') };

    await expect(exigirPinNoBloqueado(redis, clave)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: { codigo: 'CODIGO_BLOQUEADO', mensaje: expect.stringContaining('5 minutos') },
    });
  });

  it('el primer fallo fija la ventana de 5 minutos; con Redis arriba todo pasa', async () => {
    const redis: any = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue('2'),
    };

    await registrarFalloPin(redis, clave);
    expect(redis.expire).toHaveBeenCalledWith(clave, SEGUNDOS_BLOQUEO_PIN);
    expect(SEGUNDOS_BLOQUEO_PIN).toBe(300);
    await expect(exigirPinNoBloqueado(redis, clave)).resolves.toBeUndefined();
  });
});
