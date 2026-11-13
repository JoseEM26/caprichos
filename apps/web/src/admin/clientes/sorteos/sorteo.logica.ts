// Lógica pura del sorteo. Todo lo que elige usa crypto.getRandomValues (nunca Math.random).
// Los ganadores se deciden aquí, de una vez; la animación solo los muestra.

/** Entero uniforme en [0, max). Inyectable para las pruebas. */
export type Azar = (max: number) => number;

/** Muestreo por rechazo: sin sesgo de módulo. */
export const azarSeguro: Azar = (max) => {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError('max fuera de rango');
  const limite = 2 ** 32 - (2 ** 32 % max);
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b);
  while (b[0] >= limite);
  return b[0] % max;
};

/** Fisher–Yates sobre una copia. */
export function barajar<T>(xs: readonly T[], az: Azar = azarSeguro): T[] {
  const r = [...xs];
  for (let i = r.length - 1; i > 0; i--) {
    const j = az(i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const elegir = <T,>(xs: readonly T[], az: Azar = azarSeguro): T => xs[az(xs.length)];

/** Orden de salida: los n primeros de una mezcla; el n-ésimo gana. n se ajusta a [1, xs.length]. */
export function nEsimo<T>(xs: readonly T[], n: number, az: Azar = azarSeguro) {
  const k = Math.max(1, Math.min(n, xs.length));
  const orden = barajar(xs, az).slice(0, k);
  return { orden, ganador: orden[k - 1] };
}

/** K ganadores distintos, en orden de puesto (el 1.º primero). */
export const topK = <T,>(xs: readonly T[], k: number, az: Azar = azarSeguro): T[] =>
  barajar(xs, az).slice(0, Math.max(1, Math.min(k, xs.length)));

/** Rondas de eliminados (tandas) hasta que queda uno. Como mucho `maxRondas` rondas. */
export function eliminacion<T>(xs: readonly T[], az: Azar = azarSeguro, maxRondas = 8) {
  const orden = barajar(xs, az);
  const ganador = orden[orden.length - 1];
  const fuera = orden.slice(0, -1);
  const tanda = Math.max(1, Math.ceil(fuera.length / maxRondas));
  const rondas: T[][] = [];
  for (let i = 0; i < fuera.length; i += tanda) rondas.push(fuera.slice(i, i + tanda));
  return { rondas, ganador };
}

/** Gajos de la ruleta: el ganador siempre está; el resto es una muestra al azar (máx. `max`). */
export function gajosRuleta<T>(xs: readonly T[], ganador: T, max = 24, az: Azar = azarSeguro): T[] {
  const otros = barajar(xs.filter((x) => x !== ganador), az).slice(0, max - 1);
  return barajar([ganador, ...otros], az);
}
