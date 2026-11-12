/** Resumen estadístico de una lista de minutos. Sin datos devuelve n = 0 y nulos (nunca 0 inventado). */
export interface ResumenMinutos {
  n: number;
  promedio: number | null;
  mediana: number | null;
  p90: number | null;
  maximo: number | null;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Percentil por interpolación lineal (p entre 0 y 1) sobre una lista ya ordenada. */
function percentil(orden: number[], p: number): number {
  if (orden.length === 1) return orden[0];
  const pos = (orden.length - 1) * p;
  const i = Math.floor(pos);
  return orden[i] + (orden[Math.min(i + 1, orden.length - 1)] - orden[i]) * (pos - i);
}

export function resumirMinutos(valores: Array<number | null | undefined>): ResumenMinutos {
  const v = valores.filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, promedio: null, mediana: null, p90: null, maximo: null };
  return {
    n: v.length,
    promedio: r1(v.reduce((s, x) => s + x, 0) / v.length),
    mediana: r1(percentil(v, 0.5)),
    p90: r1(percentil(v, 0.9)),
    maximo: r1(v[v.length - 1]),
  };
}

/** Minutos (con un decimal) entre dos instantes; null si falta alguno o el orden es imposible (reloj o dato corregido). */
export function minutosEntre(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return ms < 0 ? null : r1(ms / 60000);
}
