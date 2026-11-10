// Cálculo puro de préstamos al personal (cuotas fijas) y descuentos recurrentes (Netflix). Sin BD.
import { Modalidad, redondear2 } from './planilla.calculo';

/** Plan de cuotas: todas iguales (monto ÷ n a céntimos) y la última absorbe la diferencia. */
export function planCuotas(monto: number, numCuotas: number): number[] {
  const n = Math.max(1, Math.floor(numCuotas));
  const base = redondear2(monto / n);
  const plan = Array.from({ length: n }, () => base);
  plan[n - 1] = redondear2(monto - base * (n - 1));
  return plan;
}

export interface CuotaCalc {
  id: string;
  prestamoId: string;
  numero: number;
  monto: number;
  estado: 'PENDIENTE' | 'DESCONTADA' | 'OMITIDA';
  periodoHasta?: string | null;
}

export interface PrestamoCalc {
  id: string;
  periodicidad: 'SEMANAL' | 'MENSUAL';
  fechaInicio: string;
  estado: string;
  cuotas: CuotaCalc[];
}

/**
 * Cuota que entra en el período: la primera PENDIENTE (por número) de cada préstamo ACTIVO ya iniciado.
 * Un préstamo MENSUAL en un período semanal solo entra si en ese mes aún no se descontó una cuota.
 */
export function cuotaDelPeriodo(p: PrestamoCalc, modalidad: Modalidad, periodo: { desde: string; hasta: string }): CuotaCalc | null {
  if (p.estado !== 'ACTIVO' || p.fechaInicio > periodo.hasta) return null;
  const mes = (f: string) => f.slice(0, 7);
  if (p.periodicidad === 'MENSUAL' && modalidad === 'SEMANAL') {
    if (p.cuotas.some((c) => c.estado === 'DESCONTADA' && c.periodoHasta && mes(c.periodoHasta) === mes(periodo.hasta) && c.periodoHasta !== periodo.hasta)) return null;
  }
  return [...p.cuotas].filter((c) => c.estado === 'PENDIENTE').sort((a, b) => a.numero - b.numero)[0] ?? null;
}

/** Meses que dura el plan: cuotas mensuales = n; semanales = n × 12/52 (misma equivalencia que el sueldo). */
export const mesesDelPlan = (numCuotas: number, periodicidad: 'SEMANAL' | 'MENSUAL'): number =>
  periodicidad === 'MENSUAL' ? numCuotas : (numCuotas * 12) / 52;

/**
 * Interés simple mensual sobre el capital (10/11/2026): interés = capital × interés% × meses del plan;
 * total = capital + interés; cuota = total ÷ nº de cuotas. 0 % = sin intereses (préstamos viejos).
 */
export const interesPrestamo = (capital: number, interesPctMensual: number, numCuotas: number, periodicidad: 'SEMANAL' | 'MENSUAL'): number =>
  redondear2(capital * (Math.max(0, interesPctMensual) / 100) * mesesDelPlan(numCuotas, periodicidad));

/** Parte de una cuota que es interés (proporcional al interés del total); 0 si no hay interés. */
export const interesDeCuota = (montoCuota: number, capital: number, interes: number): number =>
  interes > 0 ? redondear2((montoCuota * interes) / (capital + interes)) : 0;

/** Saldo = capital + interés menos lo ya descontado (pasa el total si hay interés). */
export const saldoPrestamo = (total: number, cuotas: Array<{ monto: number; estado: string }>): number =>
  redondear2(total - cuotas.filter((c) => c.estado === 'DESCONTADA').reduce((a, c) => a + c.monto, 0));

/**
 * Servicio extra / descuento recurrente en un período. SEMANAL (el monto es por semana): 1× en período semanal,
 * 4× en mensual (como Netflix). MENSUAL (el monto es por mes): 1× en período mensual, ÷4 en semanal.
 */
export const montoRecurrenteDelPeriodo = (monto: number, modalidad: Modalidad, periodicidad: 'SEMANAL' | 'MENSUAL' = 'SEMANAL'): number =>
  redondear2(periodicidad === 'MENSUAL' ? (modalidad === 'MENSUAL' ? monto : monto / 4) : monto * (modalidad === 'MENSUAL' ? 4 : 1));
