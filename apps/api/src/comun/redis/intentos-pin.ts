import { HttpException, HttpStatus } from '@nestjs/common';
import type Redis from 'ioredis';

/** Fallos seguidos del PIN de supervisor que bloquean (FT-CAJ-02 RQ-CAJ-02-12). */
export const MAX_INTENTOS_PIN = 3;
/** Bloqueo del PIN de supervisor: 1 minuto (decisión del dueño 30/10/2026; antes 5, FT-CAJ-02 RQ-CAJ-02-12). */
export const SEGUNDOS_BLOQUEO_PIN = 60;

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
    let segundos = SEGUNDOS_BLOQUEO_PIN;
    try {
      const ttl = await redis.ttl(clave);
      if (typeof ttl === 'number' && ttl > 0) segundos = ttl;
    } catch {
      // sin TTL se muestra el bloqueo completo
    }
    const minutos = Math.max(1, Math.ceil(segundos / 60));
    throw new HttpException(
      {
        codigo: 'CODIGO_BLOQUEADO',
        mensaje: `Demasiados intentos con el código del supervisor. Espera ${minutos} min o pide al administrador que lo desbloquee.`,
        segundosRestantes: segundos,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export const exigirCodigoNoBloqueado = exigirPinNoBloqueado;
export const registrarFalloCodigo = registrarFalloPin;
export const limpiarIntentosCodigo = limpiarIntentosPin;


/** Suma un fallo y fija el bloqueo de 1 minuto en el primero. */
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
