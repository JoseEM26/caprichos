/**
 * Propinas en la planilla (funciones puras, sin BD).
 * La propina de un día de Lima se reparte solo entre quienes trabajaron ESE día, en proporción a sus horas netas.
 */
import { FilaRepartoHoras, ParticipanteHoras, repartirPorHoras } from '../propinas/propinas-reparto.util';

const redondear2 = (n: number) => Math.round(n * 100) / 100;

export interface DiaPropina {
  fecha: string;
  /** Propina neta del local ese día (cobros menos devoluciones). */
  total: number;
  horasTotales: number;
  filas: FilaRepartoHoras[];
  /** Hay propina (o devolución) ese día y nadie con horas: no se reparte a nadie. */
  sinRepartir: boolean;
}

/** Línea de la planilla de una persona: su parte de un día. */
export interface LineaPropina {
  fecha: string;
  totalLocal: number;
  horas: number;
  horasTotales: number;
  porcentaje: number;
  /** Lo que se suma en este período por ese día (ya descontado lo pagado antes). */
  monto: number;
  /** true = día de un período anterior: «Propina pendiente del dd/mm». */
  pendiente: boolean;
}

/** Reparte cada día entre los participantes con horas ese día. Un total negativo (devoluciones) se reparte igual, en negativo. */
export function repartirDias(totales: Array<{ fecha: string; total: number }>, horasPorDia: Record<string, ParticipanteHoras[]>): Map<string, DiaPropina> {
  const dias = new Map<string, DiaPropina>();
  for (const { fecha, total } of totales) {
    const participantes = horasPorDia[fecha] ?? [];
    const signo = total < 0 ? -1 : 1;
    const filas = total === 0 ? [] : repartirPorHoras(Math.abs(total), participantes).map((f) => ({ ...f, monto: redondear2(f.monto * signo) }));
    dias.set(fecha, {
      fecha,
      total,
      horasTotales: redondear2(filas.reduce((a, f) => a + f.horas, 0)),
      filas,
      sinRepartir: total !== 0 && filas.length === 0,
    });
  }
  return dias;
}

/**
 * Lo que se le suma a una persona en un período: por cada día ≤ fin del período, su parte de hoy menos lo ya pagado.
 * `pagado` = suma pagada por fecha en planilla; `mesesPagados` = meses (AAAA-MM) ya pagados por el reparto mensual antiguo.
 * Los días del período aparecen si tienen diferencia; los de períodos anteriores salen como «pendiente».
 */
export function lineasDePersona(
  dias: Map<string, DiaPropina>,
  partyId: number,
  periodo: { desde: string; hasta: string },
  pagado: Map<string, number>,
  mesesPagados: Set<string>,
): LineaPropina[] {
  const fechas = new Set([...dias.keys(), ...pagado.keys()]);
  const lineas: LineaPropina[] = [];
  for (const fecha of [...fechas].sort()) {
    if (fecha > periodo.hasta || mesesPagados.has(fecha.slice(0, 7))) continue;
    const dia = dias.get(fecha);
    const fila = dia?.filas.find((f) => f.partyId === partyId);
    const monto = redondear2((fila?.monto ?? 0) - (pagado.get(fecha) ?? 0));
    if (monto === 0) continue;
    lineas.push({
      fecha,
      totalLocal: dia?.total ?? 0,
      horas: fila?.horas ?? 0,
      horasTotales: dia?.horasTotales ?? 0,
      porcentaje: fila?.porcentaje ?? 0,
      monto,
      pendiente: fecha < periodo.desde,
    });
  }
  return lineas;
}

export const totalLineas = (lineas: LineaPropina[]) => redondear2(lineas.reduce((a, l) => a + l.monto, 0));
