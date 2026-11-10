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

/** Saldo = lo prestado menos lo ya descontado. */
export const saldoPrestamo = (monto: number, cuotas: Array<{ monto: number; estado: string }>): number =>
  redondear2(monto - cuotas.filter((c) => c.estado === 'DESCONTADA').reduce((a, c) => a + c.monto, 0));

/** Descuento recurrente semanal en un período: 1× en semanal, 4× en mensual (como lo hace el dueño). */
export const montoRecurrenteDelPeriodo = (montoSemanal: number, modalidad: Modalidad): number =>
  redondear2(montoSemanal * (modalidad === 'MENSUAL' ? 4 : 1));
