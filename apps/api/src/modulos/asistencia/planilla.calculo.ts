// Cálculo puro de la planilla (sin BD): sueldo semanal/mensual, período, pago por jornada y neto.
// Dinero con redondeo a céntimos. Reglas del dueño (09/11/2026):
// Valor hora por persona (método): DIAS_HORAS (sueldo mensual ÷ días del mes ÷ horas por día, defecto 24 y 9),
// TARIFA_HORA (monto fijo por hora) o PROGRAMADAS (sueldo del período ÷ horas programadas, el método anterior).
// pago = horas trabajadas válidas × valor hora (sin tope por el sueldo en DIAS_HORAS/TARIFA_HORA). Tardanza (pasada la
// tolerancia, 10/11/2026): ese tiempo NO se paga y además hay una PENALIDAD = minutos × (valor hora ÷ 60) × factor%
// (defecto 100: pierde el doble; 0 = sin penalidad). Lo no trabajado por salir antes no se paga. El break SE PAGA
// (la jornada programada es salida − entrada). La hora extra solo suma si el admin la aprueba, a valor hora × multiplicador.

import { EstadoJornada, MarcaCalc, Turno, sumarDias, diaSemana } from './asistencia.calculo';

export type Modalidad = 'SEMANAL' | 'MENSUAL';

export const PENALIDAD_TARDANZA_PCT_DEFECTO = 100;
export const MULTIPLICADOR_EXTRA_DEFECTO = 1.25;
export const DIAS_MES_DEFECTO = 24;
export const HORAS_DIA_DEFECTO = 9;

export type MetodoValorHora = 'DIAS_HORAS' | 'TARIFA_HORA' | 'PROGRAMADAS';
export const METODOS_VALOR_HORA: readonly MetodoValorHora[] = ['DIAS_HORAS', 'TARIFA_HORA', 'PROGRAMADAS'];
/** Etiqueta de los descuentos (ajustes manuales, cuotas de préstamo y descuentos recurrentes). */
export const CATEGORIAS_DESCUENTO = ['CONSUMO', 'MERMA', 'DANO', 'PRESTAMO', 'NETFLIX', 'OTRO'] as const;
export type CategoriaDescuento = (typeof CATEGORIAS_DESCUENTO)[number];

export interface ParamsValorHora {
  metodo: MetodoValorHora;
  sueldoMensual: number;
  diasMes?: number;
  horasDia?: number;
  tarifaHora?: number;
}

/** Valor hora exacto (sin redondear) del método elegido; null en PROGRAMADAS (depende de las horas del período). */
export function valorHoraPersona(p: ParamsValorHora): number | null {
  if (p.metodo === 'PROGRAMADAS') return null;
  if (p.metodo === 'TARIFA_HORA') return Math.max(0, p.tarifaHora ?? 0);
  const dias = p.diasMes && p.diasMes > 0 ? p.diasMes : DIAS_MES_DEFECTO;
  const horas = p.horasDia && p.horasDia > 0 ? p.horasDia : HORAS_DIA_DEFECTO;
  return p.sueldoMensual / dias / horas;
}

/** Pago por día del Excel: valor hora × horas por día (DIAS_HORAS) o sueldo mensual ÷ días del mes. */
export const pagoPorDiaPersona = (p: ParamsValorHora): number | null =>
  p.metodo === 'DIAS_HORAS' ? redondear2(p.sueldoMensual / (p.diasMes && p.diasMes > 0 ? p.diasMes : DIAS_MES_DEFECTO)) : null;

/** Minutos a «H h M min» para el resumen estilo Excel. */
export const horasYMinutos = (min: number): { horas: number; minutos: number } => ({ horas: Math.floor(min / 60), minutos: min % 60 });

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
  /** Informativo (tiempo de break marcado); NO se descuenta: el break se paga. */
  breakMin?: number;
}

export interface DiaPlanilla {
  jornada: string;
  estado: EstadoJornada | 'VACACIONES';
  programadaMin: number;
  /** Minutos trabajados dentro del turno (el break cuenta como trabajado; sin extra ni tardanza). */
  trabajadaMin: number;
  /** Minutos de tardanza pasada la tolerancia (no se pagan y llevan penalidad). */
  tardanzaMin: number;
  /** Minutos del turno no trabajados por salir antes (no se pagan). */
  salidaAnticipadaMin: number;
  /** Minutos fuera del turno (antes de entrar o después de salir) pasada la tolerancia. */
  extraMin: number;
  /** Feriado activo ese día: multiplicador del valor hora para las horas trabajadas y la tardanza (vacío = 1). */
  recargo?: number;
}

/**
 * Pago de una jornada a un valor hora dado: trabajadas × valor hora × recargo del feriado (+ extra aprobada, sin recargo).
 * La penalidad por tardanza se calcula aparte (penalidadTardanzaDia) y se RESTA en los descuentos.
 * Única fuente de la fórmula: la usan el total de la planilla y el «ganado por día» de Mi asistencia.
 */
export const pagoTrabajadoDia = (d: DiaPlanilla, vh: number): number => (d.trabajadaMin / 60) * vh * (d.recargo ?? 1);
/** Penalidad del día = minutos de tardanza × (valor hora ÷ 60) × recargo del feriado × factor%. Proporcional, sin redondear a horas. */
export const penalidadTardanzaDia = (d: DiaPlanilla, vh: number, factorPct: number): number =>
  redondear2((d.tardanzaMin / 60) * vh * (d.recargo ?? 1) * (factorPct / 100));
export const pagoDia = (d: DiaPlanilla, vh: number, extraAprobada: boolean, multExtra = 1): number =>
  pagoTrabajadoDia(d, vh) + (extraAprobada ? (d.extraMin / 60) * vh * multExtra : 0);

/** Jornada de una persona: minutos programados, trabajados válidos, tardanza, salida anticipada y extra. */
export function calcularDiaPlanilla(dia: DiaEntrada, tolerancia: number): DiaPlanilla {
  const base: DiaPlanilla = {
    jornada: dia.jornada,
    estado: dia.estado,
    programadaMin: dia.turno ? dia.turno.salida - dia.turno.entrada : 0, // break pagado: entra en las horas programadas
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

  // El break se paga: no se descuenta del tiempo entre entrada y salida.
  base.trabajadaMin = Math.min(base.programadaMin, Math.max(0, fin - inicio));
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
  /** Factor de la penalidad por tardanza (% del valor del tiempo no pagado). 0 = sin penalidad. */
  penalidadTardanzaPct: number;
  /** Jornadas (ISO) cuyas horas extra aprobó el admin. */
  extrasAprobadas: ReadonlySet<string>;
  consumos: ConsumoPlanilla[];
  descuentos: number[];
  adelantos: number[];
  /** Montos de vacaciones pagadas (liquidadas en dinero) del período: ingreso adicional con su línea. */
  vacacionesPagadas?: number[];
  /** Valor hora exacto de la persona (DIAS_HORAS o TARIFA_HORA). Ausente = PROGRAMADAS (sueldo ÷ horas programadas). */
  valorHora?: number;
  /** Multiplicador de la hora extra aprobada (defecto 1: método PROGRAMADAS no cambia). */
  multiplicadorExtra?: number;
  /** Descuentos con etiqueta (ajustes manuales, cuotas de préstamo, Netflix y otros recurrentes). */
  lineasDescuento?: Array<{ categoria: string; monto: number }>;
  /** «Adicional» del Excel: bonos y ajustes positivos. */
  bonos?: number[];
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
  /** Penalidad por tardanza (se resta). */
  penalidadTardanza: number;
  penalidadTardanzaDetalle: Array<{ fecha: string; minutos: number; monto: number }>;
  pagoExtra: number;
  ganado: number;
  consumosCobrados: number;
  consumosPendientes: number;
  descuentos: number;
  adelantos: number;
  /** Valor hora sin redondear (el que se usa en los cálculos). */
  valorHoraExacto: number;
  /** Bonos / ajustes positivos. */
  adicional: number;
  /** Descuentos agrupados por etiqueta (incluye CONSUMO si se cobran en este pago). */
  descuentosPorCategoria: Record<string, number>;
  /** NETO del Excel: ganado + adicional − consumos − descuentos − penalidad (antes de restar adelantos). */
  netoAPagar: number;
  /** DIFERENCIA del Excel: neto a pagar − adelantos (lo que se transfiere). */
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

  const vh = e.valorHora !== undefined ? e.valorHora : programadaMin > 0 ? e.sueldoPeriodo / (programadaMin / 60) : 0;
  const mult = e.multiplicadorExtra ?? 1;
  // Las horas del período para el valor hora NO cambian por feriado; solo el pago de esas horas lleva recargo.
  const pagoTrabajado = redondear2(e.dias.reduce((a, d) => a + pagoTrabajadoDia(d, vh), 0));
  const pagoExtra = redondear2((extraAprobadaMin / 60) * vh * mult);
  const total = (xs: number[]) => redondear2(xs.reduce((a, x) => a + x, 0));
  const pagoVacaciones = total(e.vacacionesPagadas ?? []);
  const ganado = redondear2(pagoTrabajado + pagoExtra + pagoVacaciones);
  const penalidadTardanzaDetalle = e.dias
    .filter((d) => d.tardanzaMin > 0)
    .map((d) => ({ fecha: d.jornada, minutos: d.tardanzaMin, monto: penalidadTardanzaDia(d, vh, e.penalidadTardanzaPct) }))
    .filter((x) => x.monto > 0);
  const penalidadTardanza = redondear2(penalidadTardanzaDetalle.reduce((a, x) => a + x.monto, 0));

  const consumosCobrados = total(e.consumos.filter((c) => c.cobrar).map((c) => c.monto));
  const consumosPendientes = total(e.consumos.filter((c) => !c.cobrar).map((c) => c.monto));
  const lineas = e.lineasDescuento ?? [];
  const descuentos = redondear2(total(e.descuentos) + total(lineas.map((l) => l.monto)));
  const adelantos = total(e.adelantos);
  const adicional = total(e.bonos ?? []);
  const porCat: Record<string, number> = {};
  const sumar = (c: string, m: number) => { if (m) porCat[c] = redondear2((porCat[c] ?? 0) + m); };
  sumar('CONSUMO', consumosCobrados);
  sumar('OTRO', total(e.descuentos));
  sumar('TARDANZA', penalidadTardanza);
  lineas.forEach((l) => sumar(l.categoria, l.monto));
  const netoAPagar = redondear2(ganado + adicional - consumosCobrados - descuentos - penalidadTardanza);
  return {
    programadaMin,
    trabajadaMin,
    tardanzaMin,
    salidaAnticipadaMin,
    extraMin,
    extraAprobadaMin,
    valorHora: redondear2(vh),
    pagoTrabajado,
    penalidadTardanza,
    penalidadTardanzaDetalle,
    pagoExtra,
    pagoVacaciones,
    ganado,
    consumosCobrados,
    consumosPendientes,
    descuentos,
    adelantos,
    valorHoraExacto: vh,
    adicional,
    descuentosPorCategoria: porCat,
    netoAPagar,
    neto: redondear2(netoAPagar - adelantos),
  };
}
