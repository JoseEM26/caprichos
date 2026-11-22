/**
 * Reparto de sillas y rescate de personas atascadas (funciones puras).
 * Nadie se queda caminando en el mismo sitio: si no avanza hacia su destino en unos segundos, se lo coloca en él.
 */
export const ATASCO_SEGUNDOS = 4;
/** Cuánto tiene que acercarse (en unidades del plano) para contar como progreso. */
export const PROGRESO_MIN = 0.25;

export interface Rastro { mejor: number; desde: number }

/** Estado inicial del rastreo de un agente que acaba de salir. */
export const rastroNuevo = (t: number): Rastro => ({ mejor: Infinity, desde: t });

/**
 * Registra la distancia que falta al destino. Devuelve el rastro nuevo y si está atascado:
 * pasó `limite` segundos sin acercarse al menos PROGRESO_MIN respecto de su mejor marca.
 */
export function revisarAtasco(r: Rastro, dist: number, t: number, limite = ATASCO_SEGUNDOS): { rastro: Rastro; atascado: boolean } {
  if (dist < r.mejor - PROGRESO_MIN) return { rastro: { mejor: dist, desde: t }, atascado: false };
  return { rastro: r, atascado: t - r.desde >= limite };
}

/**
 * Sillas para `n` personas: solo sillas libres de esa mesa (índices), nunca más personas que sillas.
 * Las que no tienen silla se quedan de pie junto a la mesa (`dePie`).
 */
export function repartirSillas(n: number, totalSillas: number, ocupadas: ReadonlySet<number> = new Set()): { sillas: number[]; dePie: number } {
  const libres: number[] = [];
  for (let i = 0; i < totalSillas; i++) if (!ocupadas.has(i)) libres.push(i);
  const sillas = libres.slice(0, Math.max(0, n));
  return { sillas, dePie: Math.max(0, n - sillas.length) };
}
