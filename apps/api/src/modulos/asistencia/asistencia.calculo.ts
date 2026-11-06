// Cálculo puro de asistencia: tiempo (America/Lima, UTC-5 sin horario de verano), distancia,
// turno que corresponde a una persona en una jornada y cumplimiento del día. Sin acceso a BD.

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

export function minutosProgramados(t: Turno): number {
  const almuerzo = t.almuerzoIni !== undefined && t.almuerzoFin !== undefined ? t.almuerzoFin - t.almuerzoIni : 0;
  return t.salida - t.entrada - almuerzo;
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
  tipo: TipoMarca;
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
export function calcularJornada(entrada: {
  jornada: string;
  turno: Turno | null;
  marcas: MarcaCalc[];
  ahora: Date;
  tolerancia: number;
  motivoDescanso?: string;
}): ResultadoJornada {
  const { jornada, turno, ahora, tolerancia } = entrada;
  const marcas = [...entrada.marcas].sort((a, b) => a.minutos - b.minutos);
  const base = { programadaMin: 0, trabajadaMin: 0, almuerzoMin: 0, tardanzaMin: 0, salioAntesMin: 0, extraMin: 0 };
  const cerrada = ahora.getTime() >= cierreJornada(jornada).getTime();
  const alertas: string[] = [];

  if (!turno) {
    if (marcas.length === 0) {
      return { ...base, estado: 'DESCANSO', alertas: entrada.motivoDescanso ? [entrada.motivoDescanso] : [] };
    }
    return { ...base, estado: 'A_REVISAR', alertas: ['Marcó en un día sin horario'] };
  }

  base.programadaMin = minutosProgramados(turno);
  const primero = (t: TipoMarca) => marcas.find((m) => m.tipo === t);
  const ultimo = (t: TipoMarca) => [...marcas].reverse().find((m) => m.tipo === t);
  const entradaM = primero('ENTRADA');
  const salidaM = ultimo('SALIDA');
  const salAlm = primero('SALIDA_ALMUERZO');
  const regAlm = primero('ENTRADA_ALMUERZO');

  // Almuerzo: el real si se marcó completo; si no hubo marcas de almuerzo, el programado.
  let almuerzoDescuento = 0;
  if (salAlm && regAlm) almuerzoDescuento = Math.max(0, regAlm.minutos - salAlm.minutos);
  else if (!salAlm && !regAlm && turno.almuerzoIni !== undefined && turno.almuerzoFin !== undefined) {
    almuerzoDescuento = turno.almuerzoFin - turno.almuerzoIni;
  }
  base.almuerzoMin = almuerzoDescuento;

  if (marcas.some((m) => m.estado === 'A_REVISAR')) {
    alertas.push('Marca pendiente de revisión por el administrador');
  }

  const completo = Boolean(entradaM && salidaM) && Boolean(salAlm) === Boolean(regAlm);
  if (entradaM) base.tardanzaMin = Math.max(0, entradaM.minutos - turno.entrada);
  if (salidaM) {
    base.salioAntesMin = Math.max(0, turno.salida - salidaM.minutos);
    base.extraMin = Math.max(0, salidaM.minutos - turno.salida);
    base.trabajadaMin = Math.max(0, salidaM.minutos - (entradaM?.minutos ?? salidaM.minutos) - almuerzoDescuento);
  }

  const tarde = base.tardanzaMin > tolerancia;
  const antes = base.salioAntesMin > tolerancia && Boolean(salidaM);
  const despues = base.extraMin > tolerancia;

  if (marcas.length === 0) {
    if (cerrada) return { ...base, estado: 'FALTA', alertas };
    return { ...base, estado: 'SIN_EVALUAR', alertas };
  }
  if (marcas.some((m) => m.estado === 'A_REVISAR')) return { ...base, estado: 'A_REVISAR', alertas };
  if (!completo) {
    if (!cerrada) return { ...base, estado: 'SIN_EVALUAR', alertas };
    alertas.push('Faltan marcas del día');
    return { ...base, estado: 'INCOMPLETO', alertas };
  }
  let estado: EstadoJornada = 'CUMPLIO';
  if (tarde) estado = 'TARDANZA';
  else if (antes) estado = 'SALIO_ANTES';
  else if (despues) estado = 'SALIO_DESPUES';
  return { ...base, estado, alertas };
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
  if (ctx.coberturas.some((c) => c.fecha === jornada && c.reemplazaId === partyId)) {
    return { turno: null, motivoDescanso: 'Cubierto por otra persona' };
  }
  const propio = ctx.horarios.find((h) => h.partyId === partyId && h.dia === dia);
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
