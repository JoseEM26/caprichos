// Cálculo puro de vacaciones (sin BD). Solo vínculo PLANILLA.
// Se ganan por mes cumplido desde la fecha de ingreso: régimen ÷ 12 por mes (30/año = 2.5; 15/año = 1.25).
// Saldo = ganados + ajustes − tomadas − pagadas (los movimientos anulados no cuentan).

import { sumarDias } from './asistencia.calculo';
import type { DiaPlanilla } from './planilla.calculo';

export type RegimenVacaciones = 30 | 15;
export type TipoMovimientoVacacion = 'TOMADAS' | 'PAGADAS' | 'AJUSTE';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Meses cumplidos entre dos fechas ISO (el mes cuenta al llegar al mismo día del mes de ingreso; fin de mes cuenta completo). */
export function mesesCumplidos(ingreso: string, hasta: string): number {
  const [ai, mi, di] = ingreso.split('-').map(Number);
  const [ah, mh, dh] = hasta.split('-').map(Number);
  let m = (ah - ai) * 12 + (mh - mi);
  const ultimoDia = new Date(Date.UTC(ah, mh, 0)).getUTCDate();
  if (dh < di && dh !== ultimoDia) m -= 1;
  return Math.max(0, m);
}

/** Días ganados hasta la fecha `hasta` (inclusive) desde `ingreso`. */
export function diasGanados(ingreso: string, hasta: string, regimen: RegimenVacaciones): number {
  return r2((mesesCumplidos(ingreso, hasta) * regimen) / 12);
}

export interface MovimientoSaldo {
  tipo: TipoMovimientoVacacion;
  /** TOMADAS y PAGADAS positivos; AJUSTE con signo. */
  dias: number;
  anulado?: boolean;
}

/** Efecto de un movimiento sobre el saldo (TOMADAS y PAGADAS restan; AJUSTE suma su signo). */
export const efectoEnSaldo = (m: MovimientoSaldo): number => (m.anulado ? 0 : m.tipo === 'AJUSTE' ? m.dias : -Math.abs(m.dias));

export function resumenSaldo(ganados: number, movs: MovimientoSaldo[]) {
  const suma = (t: TipoMovimientoVacacion) => r2(movs.filter((m) => !m.anulado && m.tipo === t).reduce((a, m) => a + m.dias, 0));
  const tomadas = suma('TOMADAS');
  const pagadas = suma('PAGADAS');
  const ajustes = suma('AJUSTE');
  return { ganados: r2(ganados), tomadas, pagadas, ajustes, saldo: r2(ganados + ajustes - tomadas - pagadas) };
}

/** Fechas ISO de un rango inclusivo. */
export function fechasDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}

/** Días del rango en que la persona tiene turno (los descansos no gastan vacaciones). */
export function contarDiasHabiles(dias: ReadonlyArray<{ turno: unknown | null }>): number {
  return dias.filter((d) => d.turno).length;
}

/**
 * Días de vacación tomada: la jornada programada se paga normal (sin tardanza ni extra), no cuenta como falta
 * y queda con estado VACACIONES. Un día sin turno (descanso) no cambia.
 */
export function aplicarVacaciones(dias: DiaPlanilla[], fechasVacacion: ReadonlySet<string>): DiaPlanilla[] {
  return dias.map((d) =>
    fechasVacacion.has(d.jornada) && d.programadaMin > 0
      ? { ...d, estado: 'VACACIONES' as const, trabajadaMin: d.programadaMin, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0 }
      : d,
  );
}

/** ¿Se cruzan dos rangos ISO inclusivos? */
export const rangosSeCruzan = (a: { desde: string; hasta: string }, b: { desde: string; hasta: string }): boolean => a.desde <= b.hasta && b.desde <= a.hasta;
