// Cálculo puro de asistencia: tiempo (America/Lima, UTC-5 sin horario de verano), distancia,
// turno que corresponde a una persona en una jornada y cumplimiento del día. Sin acceso a BD.
// Las marcas se leen por orden y pares (asistencia.interpretacion.ts): el `tipo` solo manda si la marca es `fija`.

import { DOBLE_MARCA_MIN_DEFECTO, Interpretacion, interpretarMarcas } from './asistencia.interpretacion';

export type TipoMarca = 'ENTRADA' | 'SALIDA_ALMUERZO' | 'ENTRADA_ALMUERZO' | 'SALIDA';
export const TIPOS_MARCA: readonly TipoMarca[] = ['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA'];

export type EstadoJornada =
  | 'CUMPLIO'
  | 'TARDANZA'
  | 'SALIO_ANTES'
  | 'SALIO_DESPUES'
  | 'FALTA'
  | 'DESCANSO'
  | 'INCOMPLETO'
  | 'A_REVISAR'
  | 'SIN_EVALUAR';

const MS_HORA = 3_600_000;
const MIN_DIA = 1440;
/** Hora fija de cierre de la jornada (04:00 Lima del día siguiente). Antes de esa hora la marca es de la jornada anterior. */
export const HORA_CIERRE_MIN = 240;
const OFFSET_LIMA_MS = 5 * MS_HORA;



/** Suma días a una fecha ISO (YYYY-MM-DD). */
export function sumarDias(fechaIso: string, dias: number): string {
  const ms = Date.parse(`${fechaIso}T00:00:00Z`) + dias * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Día de la semana de una fecha ISO: 0 = domingo. */
export function diaSemana(fechaIso: string): number {
  return new Date(`${fechaIso}T00:00:00Z`).getUTCDay();
}

/** Jornada a la que pertenece un instante y los minutos desde el inicio de esa jornada (medianoche Lima ajustada). */
export function jornadaDe(momento: Date): { jornada: string; minutos: number } {
  const lima = new Date(momento.getTime() - OFFSET_LIMA_MS);
  const hm = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  const fecha = lima.toISOString().slice(0, 10);
  if (hm < HORA_CIERRE_MIN) return { jornada: sumarDias(fecha, -1), minutos: hm + MIN_DIA };
  return { jornada: fecha, minutos: hm };
}

/** Instante en que se cierra una jornada (04:00 Lima del día siguiente = 09:00 UTC). */
export function cierreJornada(jornada: string): Date {
  return new Date(Date.parse(`${sumarDias(jornada, 1)}T09:00:00Z`));
}

/** Minutos de un TIME de Prisma (se guarda como 1970-01-01 HH:MM en UTC) o de un «HH:MM». */
export function minutosDeHora(valor: Date | string): number {
  if (typeof valor === 'string') {
    const [h, m] = valor.split(':').map(Number);
    return h * 60 + m;
  }
  return valor.getUTCHours() * 60 + valor.getUTCMinutes();
}

export interface Turno {
  entrada: number;
  salida: number; // si es menor que la entrada, el turno cruza la medianoche (se suma 1440)
  almuerzoIni?: number;
  almuerzoFin?: number;
}

/** Arma el turno en minutos. El almuerzo solo cuenta si vienen ambos extremos. */
export function turnoDe(entrada: number, salida: number, almIni?: number | null, almFin?: number | null): Turno {
  const sal = salida <= entrada ? salida + MIN_DIA : salida;
  const t: Turno = { entrada, salida: sal };
  if (almIni !== undefined && almIni !== null && almFin !== undefined && almFin !== null) {
    let fin = almFin;
    if (fin <= almIni) fin += MIN_DIA;
    t.almuerzoIni = almIni;
    t.almuerzoFin = fin;
  }
  return t;
}

/** Minutos del turno SIN el almuerzo (lo usa planilla.calculo, que se ajusta aparte). Para asistencia: `minutosPagados`. */
export function minutosProgramados(t: Turno): number {
  const almuerzo = t.almuerzoIni !== undefined && t.almuerzoFin !== undefined ? t.almuerzoFin - t.almuerzoIni : 0;
  return t.salida - t.entrada - almuerzo;
}

/** Minutos programados que se pagan: el almuerzo cuenta (decisión del dueño 10/11/2026); su horario es solo informativo. */
export function minutosPagados(t: Turno): number {
  return t.salida - t.entrada;
}

/** Distancia en metros entre dos coordenadas (Haversine). */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface MarcaCalc {
  /** Rol guardado. Solo cuenta si la marca es `fija` (corrección del admin); si no, se interpreta por orden y pares. */
  tipo: TipoMarca;
  id?: number;
  /** Corrección del admin: conserva su `tipo`. */
  fijo?: boolean;
  /** Tipo que declaró la persona al marcar (null/ausente en marcas antiguas): manda sobre el orden y los pares. */
  declarado?: 'ENTRADA' | 'SALIDA' | 'ALMUERZO_SALIDA' | 'ALMUERZO_VUELTA' | null;
  /** El admin la separó (aprobó) o es corrección: nunca se une a otra como doble marca. */
  separada?: boolean;
  /** minutos desde el inicio de la jornada (ver jornadaDe) */
  minutos: number;
  estado: 'VALIDA' | 'A_REVISAR';
}

export interface ResultadoJornada {
  estado: EstadoJornada;
  programadaMin: number;
  trabajadaMin: number;
  almuerzoMin: number;
  tardanzaMin: number;
  salioAntesMin: number;
  extraMin: number;
  alertas: string[];
}

/**
 * Cumplimiento de una jornada de una persona. `turno` null = no le toca trabajar (descanso o cubierto).
 * `tolerancia` en minutos: por debajo de ella no hay tardanza ni salida anticipada ni extra.
 */
export function calcularJornada(entrada: Parameters<typeof evaluarJornada>[0]): ResultadoJornada {
  return evaluarJornada(entrada).resultado;
}

/** Igual que calcularJornada pero devuelve también la interpretación de las marcas (para cronograma y planilla). */
export function evaluarJornada(entrada: {
  jornada: string;
  turno: Turno | null;
  marcas: MarcaCalc[];
  ahora: Date;
  tolerancia: number;
  motivoDescanso?: string;
  /** Minutos para unir dobles marcas (defecto 3; 0 = no unir). */
  dobleMarcaMin?: number;
}): { resultado: ResultadoJornada; interp: Interpretacion } {
  const { jornada, turno, ahora, tolerancia } = entrada;
  const base = { programadaMin: 0, trabajadaMin: 0, almuerzoMin: 0, tardanzaMin: 0, salioAntesMin: 0, extraMin: 0 };
  const cerrada = ahora.getTime() >= cierreJornada(jornada).getTime();
  const interp = interpretarMarcas(entrada.marcas, turno, cerrada, entrada.dobleMarcaMin ?? DOBLE_MARCA_MIN_DEFECTO);
  const alertas: string[] = [];
  const fin = (r: Omit<ResultadoJornada, 'alertas'> & { alertas?: string[] }) => ({ resultado: { alertas, ...r } as ResultadoJornada, interp });

  if (!turno) {
    if (entrada.marcas.length === 0) {
      return fin({ ...base, estado: 'DESCANSO', alertas: entrada.motivoDescanso ? [entrada.motivoDescanso] : [] });
    }
    return fin({ ...base, estado: 'A_REVISAR', alertas: ['Marcó en un día sin horario'] });
  }

  base.programadaMin = minutosPagados(turno);
  const entradaM = interp.entrada;
  const salidaM = interp.salida;
  base.almuerzoMin = interp.breakMin;

  const contadas = interp.marcas.filter((m) => m.duplicadaDe === null);
  if (contadas.some((m) => m.estado === 'A_REVISAR')) alertas.push('Marca pendiente de revisión por el administrador');

  if (entradaM) base.tardanzaMin = Math.max(0, entradaM.minutos - turno.entrada);
  if (salidaM) {
    base.salioAntesMin = Math.max(0, turno.salida - salidaM.minutos);
    base.extraMin = Math.max(0, salidaM.minutos - turno.salida);
    // Decisión del dueño (10/11/2026): el almuerzo se paga, NO se descuenta. `almuerzoMin` es solo informativo.
    base.trabajadaMin = Math.max(0, salidaM.minutos - (entradaM?.minutos ?? salidaM.minutos));
  }

  const tarde = base.tardanzaMin > tolerancia;
  const antes = base.salioAntesMin > tolerancia && Boolean(salidaM);
  const despues = base.extraMin > tolerancia;

  if (entrada.marcas.length === 0) return fin({ ...base, estado: cerrada ? 'FALTA' : 'SIN_EVALUAR' });
  if (contadas.some((m) => m.estado === 'A_REVISAR')) return fin({ ...base, estado: 'A_REVISAR' });
  if (interp.estado === 'A_REVISAR') {
    alertas.push(...interp.alertas);
    return fin({ ...base, estado: 'A_REVISAR' });
  }
  if (interp.estado !== 'OK') {
    if (!cerrada) return fin({ ...base, estado: 'SIN_EVALUAR' });
    alertas.push('Faltan marcas del día');
    return fin({ ...base, estado: 'INCOMPLETO' });
  }
  let estado: EstadoJornada = 'CUMPLIO';
  if (tarde) estado = 'TARDANZA';
  else if (antes) estado = 'SALIO_ANTES';
  else if (despues) estado = 'SALIO_DESPUES';
  return fin({ ...base, estado });
}

/**
 * Turno de una persona en una jornada. Prioridad: cobertura por fecha (cubre), luego que la persona
 * esté cubierta por otra ese día, luego su horario fijo, y por último el reemplazo fijo del día
 * (solo marca al titular como reemplazado: no crea turno para quien lo reemplaza).
 */
export interface HorarioFila {
  partyId: bigint;
  dia: number;
  entrada: number;
  salida: number;
  almuerzoIni?: number | null;
  almuerzoFin?: number | null;
}
export interface CoberturaFila {
  fecha: string;
  cubreId: bigint;
  reemplazaId: bigint | null;
  desde: number;
  hasta: number;
}
export interface ReemplazoFila {
  partyId: bigint;
  dia: number;
  reemplazaId: bigint;
}

export function resolverTurno(
  partyId: bigint,
  jornada: string,
  ctx: { horarios: HorarioFila[]; coberturas: CoberturaFila[]; reemplazos: ReemplazoFila[] },
): { turno: Turno | null; motivoDescanso?: string } {
  const dia = diaSemana(jornada);
  const cob = ctx.coberturas.find((c) => c.fecha === jornada && c.cubreId === partyId);
  if (cob) return { turno: turnoDe(cob.desde, cob.hasta) };
  const propio = ctx.horarios.find((h) => h.partyId === partyId && h.dia === dia);
  const cubiertas = ctx.coberturas.filter((c) => c.fecha === jornada && c.reemplazaId === partyId);
  if (cubiertas.length) {
    if (!propio) return { turno: null, motivoDescanso: 'Cubierto por otra persona' };
    // Cobertura parcial (solo el inicio o el final): a la persona le queda el resto de su turno
    let { entrada, salida, almuerzoIni, almuerzoFin } = turnoDe(propio.entrada, propio.salida, propio.almuerzoIni, propio.almuerzoFin);
    for (const c of cubiertas) {
      const w = turnoDe(c.desde, c.hasta);
      if (w.entrada <= entrada) entrada = Math.max(entrada, w.salida);
      else if (w.salida >= salida) salida = Math.min(salida, w.entrada);
      else return { turno: null, motivoDescanso: 'Cubierto por otra persona' }; // cobertura en el medio: se mantiene el criterio anterior (todo el día cubierto)
    }
    if (entrada >= salida) return { turno: null, motivoDescanso: 'Cubierto por otra persona' };
    const conAlm = almuerzoIni !== undefined && almuerzoFin !== undefined && almuerzoIni > entrada && almuerzoFin < salida;
    return { turno: turnoDe(entrada, salida, conAlm ? almuerzoIni : null, conAlm ? almuerzoFin : null) };
  }
  if (propio) return { turno: turnoDe(propio.entrada, propio.salida, propio.almuerzoIni, propio.almuerzoFin) };
  const rem = ctx.reemplazos.find((r) => r.partyId === partyId && r.dia === dia);
  if (rem) return { turno: null, motivoDescanso: 'Reemplazado ese día' };
  return { turno: null };
}



/** Tipos de marca que aún se pueden registrar con las marcas que ya tiene la jornada. */
export function marcasPermitidas(tiposDelDia: ReadonlySet<TipoMarca>): TipoMarca[] {
  return TIPOS_MARCA.filter((t) => motivoNoPermitida(t, tiposDelDia) === null);
}

/** Motivo para rechazar una marca según el orden de la jornada; null si va bien. */
export function motivoNoPermitida(tipo: TipoMarca, tiposDelDia: ReadonlySet<TipoMarca>): string | null {
  const tiene = (t: TipoMarca) => tiposDelDia.has(t);
  if (tipo === 'ENTRADA') {
    return tiene('ENTRADA') ? 'Ya marcaste la entrada de hoy' : null;
  }
  if (!tiene('ENTRADA')) return 'Primero marca tu entrada';
  if (tiene('SALIDA')) return 'Tu jornada ya tiene salida registrada';
  if (tipo === 'SALIDA_ALMUERZO') {
    return tiene('SALIDA_ALMUERZO') ? 'Ya marcaste la salida a almuerzo' : null;
  }
  if (tipo === 'ENTRADA_ALMUERZO') {
    if (!tiene('SALIDA_ALMUERZO')) return 'Primero marca tu salida a almuerzo';
    return tiene('ENTRADA_ALMUERZO') ? 'Ya marcaste tu regreso de almuerzo' : null;
  }
  // SALIDA
  if (tiene('SALIDA_ALMUERZO') && !tiene('ENTRADA_ALMUERZO')) return 'Primero marca tu regreso de almuerzo';
  return null;
}

/** Marca que toca registrar ahora (la más natural): null si la jornada ya está completa. */
export function marcaPendiente(tiposDelDia: ReadonlySet<TipoMarca>): TipoMarca | null {
  if (!tiposDelDia.has('ENTRADA')) return 'ENTRADA';
  if (tiposDelDia.has('SALIDA')) return null;
  if (tiposDelDia.has('SALIDA_ALMUERZO') && !tiposDelDia.has('ENTRADA_ALMUERZO')) return 'ENTRADA_ALMUERZO';
  return 'SALIDA';
}

/** «HH:MM» de minutos de jornada (los pasados de 24 h vuelven a empezar). */
export function aHoraTexto(minutos: number): string {
  const m = ((minutos % MIN_DIA) + MIN_DIA) % MIN_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
