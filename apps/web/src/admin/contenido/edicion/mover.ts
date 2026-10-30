/** Intercambia un elemento con su vecino (dir -1 sube, 1 baja). Si no hay vecino devuelve la misma lista. */
export function moverIndice<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** Saca el elemento `desde` y lo deja en el lugar que ocupaba `hacia` (arrastrar y soltar). */
export function reubicar<T>(lista: T[], desde: number, hacia: number): T[] {
  if (desde < 0 || hacia < 0 || desde === hacia) return lista;
  const copia = [...lista];
  const [item] = copia.splice(desde, 1);
  copia.splice(hacia, 0, item);
  return copia;
}

/** Siguiente valor de una lista circular (para los botones que ciclan tamaños). */
export function siguiente<T>(valores: readonly T[], actual: T): T {
  return valores[(valores.indexOf(actual) + 1) % valores.length];
}
