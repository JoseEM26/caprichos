import { randomUUID } from 'crypto';

/** Colas en memoria por clave: dentro de un proceso, los trabajos de una misma clave corren de uno en uno. */
const colas = new Map<string, Promise<unknown>>();

/**
 * Ejecuta `fn` en serie por clave (una conversación): lo que llega mientras otro se procesa ESPERA y corre después.
 * Capa 1: cola en memoria (mismo proceso). Capa 2: candado Redis SET NX PX (varios procesos); si Redis falla
 * se sigue solo con la cola en memoria (fail-open, nunca se pierde el mensaje).
 */
export async function ejecutarEnSerie<T>(
  clave: string,
  redis: { set: (...a: any[]) => Promise<any>; eval?: (...a: any[]) => Promise<any> } | null,
  fn: () => Promise<T>,
  opciones: { ttlMs?: number; esperaMaxMs?: number } = {},
): Promise<T> {
  const previo = colas.get(clave) ?? Promise.resolve();
  const corrida = previo.catch(() => undefined).then(() => conCandadoRedis(clave, redis, fn, opciones));
  colas.set(clave, corrida);
  try {
    return await corrida;
  } finally {
    if (colas.get(clave) === corrida) colas.delete(clave);
  }
}

async function conCandadoRedis<T>(clave: string, redis: any, fn: () => Promise<T>, o: { ttlMs?: number; esperaMaxMs?: number }): Promise<T> {
  if (!redis) return fn();
  const llave = `chatbot:candado:${clave}`;
  const token = randomUUID();
  const ttl = o.ttlMs ?? 60_000;
  const limite = Date.now() + (o.esperaMaxMs ?? 60_000);
  let tomado = false;
  try {
    while (!tomado && Date.now() < limite) {
      tomado = (await redis.set(llave, token, 'PX', ttl, 'NX')) === 'OK';
      if (!tomado) await new Promise((r) => setTimeout(r, 100));
    }
  } catch {
    tomado = false; // Redis caído: se sigue con la cola en memoria
  }
  try {
    return await fn();
  } finally {
    if (tomado) {
      try {
        await redis.eval?.(
          "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0",
          1, llave, token,
        );
      } catch { /* liberar el candado es best-effort; expira solo por TTL */ }
    }
  }
}
