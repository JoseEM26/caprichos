import { HttpException, HttpStatus } from '@nestjs/common';

// ponytail: límite en memoria por IP (un proceso). Con varias instancias, moverlo a Redis.
const VENTANA_MS = 60_000;
const pedidos = new Map<string, number[]>();

/** Corta con 429 si la IP pasa de `max` pedidos por minuto en el cupo `cupo`. */
export function limitarTv(cupo: string, req: any, max: number): void {
  const ip = (req.ip || req.headers?.['x-forwarded-for'] || 'desconocida') as string;
  const clave = `${cupo}:${ip}`;
  const ahora = Date.now();
  const lista = (pedidos.get(clave) ?? []).filter((t) => t > ahora - VENTANA_MS);
  lista.push(ahora);
  pedidos.set(clave, lista);
  if (lista.length > max) {
    throw new HttpException({ codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Espera un momento.' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Llave Bearer de la TV (nunca se registra en logs). */
export function llaveDe(req: any): string | undefined {
  const h = req.headers?.['authorization'];
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() || undefined : undefined;
}
