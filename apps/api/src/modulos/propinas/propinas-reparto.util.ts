/**
 * Reparto mensual de propinas por horas trabajadas (función pura, sin BD).
 * Trabaja en céntimos con BigInt: la suma de los montos es exacta y no se inventan céntimos.
 */

export interface ParticipanteHoras {
  partyId: number;
  /** Horas netas del mes, con 2 decimales (lo que muestra asistencia). */
  horas: number;
}

export interface FilaRepartoHoras {
  partyId: number;
  horas: number;
  /** Porcentaje de las horas totales, 4 decimales. */
  porcentaje: number;
  monto: number;
}

/**
 * Reparte `totalPropinas` (soles) en proporción a las horas. Las personas con 0 horas no reciben.
 * Método del resto mayor: cada una recibe la parte entera en céntimos y el sobrante se da de uno en
 * uno a quien tenga mayor residuo (empate: el orden de entrada). Suma exacta = total.
 * Si no hay horas positivas devuelve []: el llamador decide el error.
 */
export function repartirPorHoras(totalPropinas: number, participantes: ParticipanteHoras[]): FilaRepartoHoras[] {
  const pesos = participantes
    .map((p) => ({ partyId: p.partyId, w: BigInt(Math.round(p.horas * 100)) }))
    .filter((p) => p.w > 0n);
  const W = pesos.reduce((a, p) => a + p.w, 0n);
  if (W === 0n) return [];
  const C = BigInt(Math.round(totalPropinas * 100));

  const base = pesos.map((p) => (C * p.w) / W);
  const resto = Number(C - base.reduce((a, b) => a + b, 0n));
  const orden = pesos
    .map((p, i) => ({ i, r: (C * p.w) % W }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; k < resto; k++) base[orden[k].i] += 1n;

  return pesos.map((p, i) => ({
    partyId: p.partyId,
    horas: Number(p.w) / 100,
    porcentaje: Math.round((Number(p.w) / Number(W)) * 1_000_000) / 10_000,
    monto: Number(base[i]) / 100,
  }));
}

/** Firma de un reparto (partyId, horas y monto): sirve para saber si las cifras cambiaron desde el borrador. */
export function firmaReparto(total: number, filas: Array<{ partyId: number; horas: number; monto: number }>): string {
  const cuerpo = [...filas]
    .sort((a, b) => a.partyId - b.partyId)
    .map((f) => `${f.partyId}:${f.horas.toFixed(2)}:${f.monto.toFixed(2)}`)
    .join('|');
  return `${total.toFixed(2)}#${cuerpo}`;
}

export const ESTADOS_REPARTO = ['BORRADOR', 'APROBADO', 'PAGADO', 'ANULADO'] as const;
export type EstadoReparto = (typeof ESTADOS_REPARTO)[number];

export const MEDIOS_PAGO_PROPINA = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'] as const;
