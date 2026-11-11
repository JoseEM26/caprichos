/**
 * Cliente mínimo de https://dniruc.apisperu.com (DNI y RUC). El token va SOLO en el header Authorization (nunca en la URL).
 * Un «no encontrado» NO es 404: responde HTTP 200 con {success:false, message:"No se encontraron resultados."}.
 * Nunca registra ni el documento ni los datos devueltos: solo el estado HTTP o el tipo de error.
 */
import type { Logger } from '@nestjs/common';

export const APISPERU_URL = 'https://dniruc.apisperu.com/api/v1/';
export const APISPERU_TIMEOUT_MS = 5000;
export const TOPE_MENSUAL_DEFECTO = 1000;

export type ResultadoApisperu =
  | { estado: 'ok'; json: Record<string, unknown> }
  | { estado: 'no_encontrado' }
  | { estado: 'no_disponible' };

export const tokenApisperu = (): string => (process.env.DNIRUC_TOKEN ?? '').trim();

/** Tope mensual de consultas (plan de apisperu): configurable con DNIRUC_TOPE_MENSUAL; el dueño debe revisarlo contra su plan. */
export function topeMensualApisperu(): number {
  const n = Number(process.env.DNIRUC_TOPE_MENSUAL);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : TOPE_MENSUAL_DEFECTO;
}

export async function consultarApisperu(tipo: 'dni' | 'ruc', documento: string, token: string, logger: Logger): Promise<ResultadoApisperu> {
  let res: Response;
  try {
    res = await fetch(`${APISPERU_URL}${tipo}/${documento}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(APISPERU_TIMEOUT_MS),
    });
  } catch (e) {
    logger.warn(`Consulta ${tipo} falló: ${(e as Error).name}`);
    return { estado: 'no_disponible' };
  }
  if (res.status === 404) return { estado: 'no_encontrado' };
  if (!res.ok) {
    // 401/403 (token) o 429 (plan agotado) y 5xx: para el usuario es lo mismo, escribe a mano
    logger.warn(`Consulta ${tipo} respondió HTTP ${res.status}`);
    return { estado: 'no_disponible' };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    logger.warn(`Consulta ${tipo} con respuesta no JSON`);
    return { estado: 'no_disponible' };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { estado: 'no_disponible' };
  const obj = json as Record<string, unknown>;
  if (obj.success === false) {
    // Solo «sin resultados» es no encontrado; cualquier otro mensaje (token, cuota) es servicio no disponible
    if (typeof obj.message === 'string' && /no se encontr/i.test(obj.message)) return { estado: 'no_encontrado' };
    logger.warn(`Consulta ${tipo} rechazada por el servicio`);
    return { estado: 'no_disponible' };
  }
  return { estado: 'ok', json: obj };
}
