// Cálculo puro de la planilla (sin BD): sueldo semanal/mensual, período, pago por jornada y neto.
// Dinero con redondeo a céntimos. Reglas del dueño (09/11/2026):
// valor hora = sueldo del período ÷ horas programadas del período (sin break, sin descansos);
// pago = horas trabajadas válidas × valor hora; la tardanza (pasada la tolerancia) se paga al pctTardanza % y ya es
// el descuento; lo no trabajado por salir antes no se paga; el break no se paga; la hora extra solo suma si el admin la aprueba.

import { EstadoJornada, MarcaCalc, Turno, minutosProgramados, sumarDias, diaSemana } from './asistencia.calculo';

export type Modalidad = 'SEMANAL' | 'MENSUAL';

export const PCT_TARDANZA_DEFECTO = 50;

export const redondear2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Dado el sueldo de una modalidad, el otro: semanal = mensual×12/52; mensual = semanal×52/12. */
export function sueldoEquivalente(modalidad: Modalidad, monto: number): { semanal: number; mensual: number } {
  if (modalidad === 'MENSUAL') return { semanal: redondear2((monto * 12) / 52), mensual: redondear2(monto) };
  return { semanal: redondear2(monto), mensual: redondear2((monto * 52) / 12) };
}

/** Período (lunes a domingo, o mes calendario) que contiene la fecha ISO. */
export function periodoDe(modalidad: Modalidad, fecha: string): { desde: string; hasta: string } {
  if (modalidad === 'SEMANAL') {
    const atras = (diaSemana(fecha) + 6) % 7; // lunes = 0
    const desde = sumarDias(fecha, -atras);
    return { desde, hasta: sumarDias(desde, 6) };
  }
  const [a, m] = fecha.split('-').map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(dias).padStart(2, '0')}` };
}

/** Estados con los que la jornada se puede pagar tal cual. */
const PAGABLES: readonly EstadoJornada[] = ['CUMPLIO', 'TARDANZA', 'SALIO_ANTES', 'SALIO_DESPUES'];
/** Estados que impiden marcar el período como pagado hasta que el admin los corrija. */
export const ESTADOS_PENDIENTES: readonly EstadoJornada[] = ['INCOMPLETO', 'A_REVISAR'];

export interface DiaEntrada {
  jornada: string;
  estado: EstadoJornada;
  turno: Turno | null;
  /** Marcas que cuentan, ya con su rol interpretado (ver asistencia.interpretacion.ts). */
  marcas: MarcaCalc[];
  /** Break real descontado según la interpretación (pares válidos; sin marcas de break, el programado). Ausente = cálculo antiguo. */
  breakMin?: number;
}

export interface DiaPlanilla {
  jornada: string;
  estado: EstadoJornada | 'VACACIONES';
  programadaMin: number;
  /** Minutos trabajados dentro del turno (sin break, sin extra, sin tardanza). */
  trabajadaMin: number;
  /** Minutos de tardanza pasada la tolerancia (se pagan al pctTardanza %). */
  tardanzaMin: number;
  /** Minutos del turno no trabajados por salir antes (no se pagan). */
  salidaAnticipadaMin: number;
  /** Minutos fuera del turno (antes de entrar o después de salir) pasada la tolerancia. */
  extraMin: number;
  /** Feriado activo ese día: multiplicador del valor hora para las horas trabajadas y la tardanza (vacío = 1). */
  recargo?: number;
}

/**
 * Pago de una jornada a un valor hora dado: (trabajadas + tardanza × pct%) × valor hora × recargo del feriado.
 * La tardanza en feriado se paga al pct% del valor hora YA recargado. La hora extra aprobada no lleva recargo.
 * Única fuente de la fórmula: la usan el total de la planilla y el «ganado por día» de Mi asistencia.
 */
export const pagoTrabajadoDia = (d: DiaPlanilla, vh: number): number => (d.trabajadaMin / 60) * vh * (d.recargo ?? 1);
export const pagoTardanzaDia = (d: DiaPlanilla, vh: number, pct: number): number => (d.tardanzaMin / 60) * vh * (d.recargo ?? 1) * (pct / 100);
export const pagoDia = (d: DiaPlanilla, vh: number, pct: number, extraAprobada: boolean): number =>
  pagoTrabajadoDia(d, vh) + pagoTardanzaDia(d, vh, pct) + (extraAprobada ? (d.extraMin / 60) * vh : 0);

/** Jornada de una persona: minutos programados, trabajados válidos, tardanza, salida anticipada y extra. */
export function calcularDiaPlanilla(dia: DiaEntrada, tolerancia: number): DiaPlanilla {
  const base: DiaPlanilla = {
    jornada: dia.jornada,
    estado: dia.estado,
    programadaMin: dia.turno ? minutosProgramados(dia.turno) : 0,
    trabajadaMin: 0,
    tardanzaMin: 0,
    salidaAnticipadaMin: 0,
    extraMin: 0,
  };
  const t = dia.turno;
  if (!t || !PAGABLES.includes(dia.estado)) return base;
  const entrada = dia.marcas.find((m) => m.tipo === 'ENTRADA');
  const salida = [...dia.marcas].reverse().find((m) => m.tipo === 'SALIDA');
  if (!entrada || !salida) return base;

  const antes = t.entrada - entrada.minutos; // >0 llegó antes
  const tarde = entrada.minutos - t.entrada; // >0 llegó tarde
  let inicio = entrada.minutos;
  if (antes > 0) {
    if (antes > tolerancia) base.extraMin += antes;
    inicio = t.entrada;
  } else if (tarde <= tolerancia) {
    inicio = t.entrada; // dentro de la tolerancia: se paga completo
  } else {
    base.tardanzaMin = tarde;
  }

  const despues = salida.minutos - t.salida; // >0 salió después
  const temprano = t.salida - salida.minutos; // >0 salió antes
  let fin = salida.minutos;
  if (despues > 0) {
    if (despues > tolerancia) base.extraMin += despues;
    fin = t.salida;
  } else if (temprano > 0 && temprano <= tolerancia) {
    fin = t.salida;
  } else if (temprano > 0) {
    base.salidaAnticipadaMin = temprano;
  }

  // Break: el real si se marcó completo; si no hubo marcas de break, el programado.
  const salAlm = dia.marcas.find((m) => m.tipo === 'SALIDA_ALMUERZO');
  const regAlm = dia.marcas.find((m) => m.tipo === 'ENTRADA_ALMUERZO');
  let breakMin = 0;
  if (dia.breakMin !== undefined) breakMin = dia.breakMin;
  else if (salAlm && regAlm) breakMin = Math.max(0, regAlm.minutos - salAlm.minutos);
  else if (!salAlm && !regAlm && t.almuerzoIni !== undefined && t.almuerzoFin !== undefined) breakMin = t.almuerzoFin - t.almuerzoIni;

  base.trabajadaMin = Math.min(base.programadaMin, Math.max(0, fin - inicio - breakMin));
  return base;
}

export interface ConsumoPlanilla {
  id: string;
  monto: number;
  cobrar: boolean;
  [extra: string]: unknown;
}

export interface EntradaPlanilla {
  modalidad: Modalidad;
  /** Sueldo del período (semanal o mensual según la modalidad). */
  sueldoPeriodo: number;
  dias: DiaPlanilla[];
  pctTardanza: number;
  /** Jornadas (ISO) cuyas horas extra aprobó el admin. */
  extrasAprobadas: ReadonlySet<string>;
  consumos: ConsumoPlanilla[];
  descuentos: number[];
  adelantos: number[];
  /** Montos de vacaciones pagadas (liquidadas en dinero) del período: ingreso adicional con su línea. */
  vacacionesPagadas?: number[];
}

export interface ResultadoPlanilla {
  pagoVacaciones: number;
  programadaMin: number;
  trabajadaMin: number;
  tardanzaMin: number;
  salidaAnticipadaMin: number;
  extraMin: number;
  extraAprobadaMin: number;
  valorHora: number;
  pagoTrabajado: number;
  pagoTardanza: number;
  pagoExtra: number;
  ganado: number;
  consumosCobrados: number;
  consumosPendientes: number;
  descuentos: number;
  adelantos: number;
  neto: number;
}

export function calcularPlanilla(e: EntradaPlanilla): ResultadoPlanilla {
  const suma = (f: (d: DiaPlanilla) => number) => e.dias.reduce((a, d) => a + f(d), 0);
  const programadaMin = suma((d) => d.programadaMin);
  const trabajadaMin = suma((d) => d.trabajadaMin);
  const tardanzaMin = suma((d) => d.tardanzaMin);
  const salidaAnticipadaMin = suma((d) => d.salidaAnticipadaMin);
  const extraMin = suma((d) => d.extraMin);
  const extraAprobadaMin = e.dias.filter((d) => e.extrasAprobadas.has(d.jornada)).reduce((a, d) => a + d.extraMin, 0);

  const vh = programadaMin > 0 ? e.sueldoPeriodo / (programadaMin / 60) : 0;
  // Las horas del período para el valor hora NO cambian por feriado; solo el pago de esas horas lleva recargo.
  const pagoTrabajado = redondear2(e.dias.reduce((a, d) => a + pagoTrabajadoDia(d, vh), 0));
  const pagoTardanza = redondear2(e.dias.reduce((a, d) => a + pagoTardanzaDia(d, vh, e.pctTardanza), 0));
  const pagoExtra = redondear2((extraAprobadaMin / 60) * vh);
  const total = (xs: number[]) => redondear2(xs.reduce((a, x) => a + x, 0));
  const pagoVacaciones = total(e.vacacionesPagadas ?? []);
  const ganado = redondear2(pagoTrabajado + pagoTardanza + pagoExtra + pagoVacaciones);

  const consumosCobrados = total(e.consumos.filter((c) => c.cobrar).map((c) => c.monto));
  const consumosPendientes = total(e.consumos.filter((c) => !c.cobrar).map((c) => c.monto));
  const descuentos = total(e.descuentos);
  const adelantos = total(e.adelantos);
  return {
    programadaMin,
    trabajadaMin,
    tardanzaMin,
    salidaAnticipadaMin,
    extraMin,
    extraAprobadaMin,
    valorHora: redondear2(vh),
    pagoTrabajado,
    pagoTardanza,
    pagoExtra,
    pagoVacaciones,
    ganado,
    consumosCobrados,
    consumosPendientes,
    descuentos,
    adelantos,
    neto: redondear2(ganado - consumosCobrados - descuentos - adelantos),
  };
}
