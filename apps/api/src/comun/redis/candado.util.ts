import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('CandadoRedis');

export const SCRIPT_LIBERAR_CANDADO = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface ResultadoCandado<T> {
  ejecutado: boolean;
  razon?: 'bloqueado' | 'error';
  fallback?: boolean;
  resultado?: T;
}

export interface OpcionesCandado {
  ttlMs?: number;
  token?: string;
  logger?: { warn: (msg: string) => void; error?: (msg: string, stack?: string) => void };
}

/**
 * Intenta adquirir un candado distribuido en Redis usando SET clave valor NX PX ttlMs.
 * Si Redis falla o no está disponible, se activa el fallback (retorna adquirido: true, fallback: true)
 * para garantizar la continuidad operativa de la tarea sin perder ejecuciones críticas.
 */
export async function adquirirCandado(
  redis: Redis | null | undefined,
  clave: string,
  ttlMs = 25000,
  tokenPropio?: string,
): Promise<{ adquirido: boolean; token: string; fallback: boolean }> {
  const token = tokenPropio || randomUUID();

  if (!redis) {
    logger.warn(`Redis no provisto para el candado '${clave}'. Ejecutando por fallback.`);
    return { adquirido: true, token, fallback: true };
  }

  try {
    // Usamos SET NX PX (milisegundos) para bloqueo atómico con expiración
    const res = await redis.set(clave, token, 'PX', ttlMs, 'NX');
    if (res === 'OK') {
      return { adquirido: true, token, fallback: false };
    }
    return { adquirido: false, token, fallback: false };
  } catch (error: any) {
    logger.warn(
      `Fallo al comunicar con Redis para candado '${clave}': ${error?.message || error}. Ejecutando por fallback.`,
    );
    return { adquirido: true, token, fallback: true };
  }
}

/**
 * Libera el candado en Redis SÓLO SI el valor almacenado coincide exactamente con el token propio.
 * Utiliza un script Lua atómico para evitar liberar candados expirados o reasignados a otras réplicas.
 */
export async function liberarCandado(
  redis: Redis | null | undefined,
  clave: string,
  token: string,
): Promise<boolean> {
  if (!redis || !token) {
    return false;
  }

  try {
    if (typeof redis.eval === 'function') {
      const res = await redis.eval(SCRIPT_LIBERAR_CANDADO, 1, clave, token);
      return res === 1;
    }
    if (typeof (redis as any).del === 'function') {
      await (redis as any).del(clave);
      return true;
    }
    return false;
  } catch (error: any) {
    logger.warn(`Error al liberar candado '${clave}' en Redis: ${error?.message || error}`);
    return false;
  }
}

/**
 * Envoltorio de alto nivel que adquiere el candado, ejecuta la acción si fue adquirido
 * (o si aplica fallback por Redis caído), y asegura la liberación sólo del candado propio.
 */
export async function ejecutarConCandado<T>(
  redis: Redis | null | undefined,
  clave: string,
  accion: () => Promise<T>,
  opciones?: OpcionesCandado,
): Promise<ResultadoCandado<T>> {
  const ttlMs = opciones?.ttlMs ?? 25000;
  const token = opciones?.token || randomUUID();

  const { adquirido, fallback } = await adquirirCandado(redis, clave, ttlMs, token);

  if (!adquirido) {
    return { ejecutado: false, razon: 'bloqueado' };
  }

  try {
    const resultado = await accion();
    return { ejecutado: true, fallback, resultado };
  } finally {
    if (!fallback) {
      await liberarCandado(redis, clave, token).catch(() => false);
    }
  }
}
