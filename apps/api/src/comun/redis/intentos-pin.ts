import { HttpException, HttpStatus } from '@nestjs/common';
import type Redis from 'ioredis';

/** Fallos seguidos del PIN de supervisor que bloquean (FT-CAJ-02 RQ-CAJ-02-12). */
export const MAX_INTENTOS_PIN = 3;
/** Bloqueo del PIN de supervisor: 5 minutos (FT-CAJ-02 RQ-CAJ-02-12). */
export const SEGUNDOS_BLOQUEO_PIN = 5 * 60;

/**
 * Contador de intentos del PIN de supervisor. Falla CERRADO: si Redis no responde no se
 * valida ningún PIN (503), porque sin contador no hay bloqueo contra la fuerza bruta.
 */
function redisNoDisponible(): HttpException {
  return new HttpException(
    {
      codigo: 'PIN_NO_DISPONIBLE',
      mensaje: 'No se puede validar el PIN ahora, intenta en unos minutos',
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

/** Lanza CODIGO_BLOQUEADO si la clave ya tiene 3 fallos; 503 si Redis no responde. */
export async function exigirPinNoBloqueado(redis: Redis, clave: string): Promise<void> {
  let actuales: string | null;
  try {
    actuales = await redis.get(clave);
  } catch {
    throw redisNoDisponible();
  }
  if (actuales && parseInt(actuales, 10) >= MAX_INTENTOS_PIN) {
    throw new HttpException(
      {
        codigo: 'CODIGO_BLOQUEADO',
        mensaje: 'Demasiados intentos fallidos de código de supervisor. Espera 5 minutos.',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export const exigirCodigoNoBloqueado = exigirPinNoBloqueado;
export const registrarFalloCodigo = registrarFalloPin;
export const limpiarIntentosCodigo = limpiarIntentosPin;


/** Suma un fallo y fija el bloqueo de 5 minutos en el primero. */
export async function registrarFalloPin(redis: Redis, clave: string): Promise<void> {
  try {
    const fallos = await redis.incr(clave);
    if (fallos === 1) {
      await redis.expire(clave, SEGUNDOS_BLOQUEO_PIN);
    }
  } catch {
    throw redisNoDisponible();
  }
}

/** Borra los fallos tras un PIN válido. */
export async function limpiarIntentosPin(redis: Redis, clave: string): Promise<void> {
  try {
    await redis.del(clave);
  } catch {
    throw redisNoDisponible();
  }
}
