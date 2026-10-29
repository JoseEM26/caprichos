import type Redis from 'ioredis';

export interface BloqueoSpam {
  activo: boolean;
  hastaEn: string | null;
  reincidente: boolean;
}

/** Clave Redis del bloqueo temporal: la fuente de verdad del estado "Bloqueado por spam" (caduca con su TTL). */
export const claveBloqueoSpam = (identificador: string) => `chatbot:spam:bloqueo:${encodeURIComponent(identificador.trim())}`;

/** Valor guardado en la clave: 'R' si el bloqueo es por reincidencia, '1' si es el primero. */
export const VALOR_BLOQUEO_REINCIDENTE = 'R';

/**
 * Lee el bloqueo de varios contactos en UNA sola ida a Redis (pipeline). Devuelve null si Redis falla:
 * quien llama debe tratarlo como "no se sabe", no como "sin bloqueo".
 */
export async function leerBloqueosSpam(
  redis: Redis | undefined | null,
  identificadores: string[],
): Promise<Map<string, BloqueoSpam> | null> {
  if (!redis) return null;
  const mapa = new Map<string, BloqueoSpam>();
  if (identificadores.length === 0) return mapa;
  try {
    const pipe = redis.pipeline();
    for (const id of identificadores) {
      pipe.get(claveBloqueoSpam(id));
      pipe.pttl(claveBloqueoSpam(id));
    }
    const res = await pipe.exec();
    if (!res) return null;
    const ahora = Date.now();
    identificadores.forEach((id, i) => {
      const [e1, valor] = res[i * 2] ?? [];
      const [e2, ttl] = res[i * 2 + 1] ?? [];
      if (e1 || e2) throw e1 || e2;
      const ms = Number(ttl);
      const activo = valor != null && ms !== -2;
      mapa.set(id, {
        activo,
        hastaEn: activo && ms > 0 ? new Date(ahora + ms).toISOString() : null,
        reincidente: activo && valor === VALOR_BLOQUEO_REINCIDENTE,
      });
    });
    return mapa;
  } catch {
    return null;
  }
}
