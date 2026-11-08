/** Agotado con cronómetro: cálculos puros de la hora de regreso (todo en hora de Lima, UTC-5 fijo, sin horario de verano). */

export interface HorarioDia {
  dia_semana: number; // 1 lunes .. 7 domingo
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

export type EleccionAgotado =
  | { tipo: 'indefinido' }
  | { tipo: 'min'; min: number }
  | { tipo: 'cierre' }
  | { tipo: 'manana' }
  | { tipo: 'dur'; horas: number; min: number }
  | { tipo: 'hora'; hhmm: string; dia: 'hoy' | 'manana' };

export const MIN_MINUTOS = 1;
export const MAX_MINUTOS = 7 * 24 * 60;

/** Agotado «hasta que lo reactive una persona» (el servidor guarda el año 9999). */
export function esIndefinido(iso: string | null | undefined): boolean {
  return !iso || new Date(iso).getUTCFullYear() >= 9999;
}

const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtFecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });

/** «15:40» en Lima. */
export function horaLima(ms: number): string {
  return fmtHora.format(new Date(ms));
}

/** «YYYY-MM-DD» en Lima. */
export function fechaLima(ms: number): string {
  return fmtFecha.format(new Date(ms));
}

function sumarDias(fechaIso: string, n: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function diaSemana(fechaIso: string): number {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return js === 0 ? 7 : js;
}

const instanteLima = (fechaIso: string, hhmm: string) => new Date(`${fechaIso}T${hhmm}:00-05:00`).getTime();

/** Cierre de hoy según el horario; null si cerrado, sin horario o ya pasó. ponytail: un cierre pasada la medianoche cuenta al día siguiente. */
export function cierreHoy(horario: HorarioDia[] | null | undefined, ahoraMs: number): number | null {
  const hoy = fechaLima(ahoraMs);
  const h = horario?.find((x) => x.dia_semana === diaSemana(hoy));
  if (!h || h.cerrado || !h.cierra) return null;
  let t = instanteLima(hoy, h.cierra);
  if (h.abre && h.cierra <= h.abre) t = instanteLima(sumarDias(hoy, 1), h.cierra);
  return t > ahoraMs ? t : null;
}

/** Apertura de mañana según el horario; null si mañana está cerrado o no hay horario. */
export function aperturaManana(horario: HorarioDia[] | null | undefined, ahoraMs: number): number | null {
  const man = sumarDias(fechaLima(ahoraMs), 1);
  const h = horario?.find((x) => x.dia_semana === diaSemana(man));
  if (!h || h.cerrado || !h.abre) return null;
  return instanteLima(man, h.abre);
}

/** Hora de regreso (ms) de una elección; null = indefinido; {error} si no es válida. */
export function resolverRegreso(
  e: EleccionAgotado,
  ahoraMs: number,
  horario?: HorarioDia[] | null,
): { hasta: number | null } | { error: string } {
  const porMinutos = (min: number) => {
    if (!Number.isFinite(min) || min < MIN_MINUTOS) return { error: 'Pon al menos 1 minuto' };
    if (min > MAX_MINUTOS) return { error: 'Máximo 7 días; para más tiempo usa «hasta que lo reactive yo»' };
    return { hasta: ahoraMs + min * 60_000 };
  };
  switch (e.tipo) {
    case 'indefinido':
      return { hasta: null };
    case 'min':
      return porMinutos(e.min);
    case 'dur':
      return porMinutos(Math.floor(e.horas || 0) * 60 + Math.floor(e.min || 0));
    case 'cierre': {
      const t = cierreHoy(horario, ahoraMs);
      return t ? { hasta: t } : { error: 'Hoy ya cerró el local o no hay horario' };
    }
    case 'manana': {
      const t = aperturaManana(horario, ahoraMs);
      return t ? { hasta: t } : { error: 'Mañana no hay horario de apertura' };
    }
    case 'hora': {
      if (!/^\d{2}:\d{2}$/.test(e.hhmm)) return { error: 'Elige la hora' };
      const hoy = fechaLima(ahoraMs);
      const t = instanteLima(e.dia === 'hoy' ? hoy : sumarDias(hoy, 1), e.hhmm);
      if (t <= ahoraMs) return { error: 'Esa hora ya pasó' };
      const r = porMinutos(Math.ceil((t - ahoraMs) / 60_000));
      return 'error' in r ? r : { hasta: t };
    }
  }
}

/** «38 min», «1 h 05», «2 d» (minutos que faltan, redondeado hacia arriba). */
export function textoRestante(min: number): string {
  if (min >= 1440) return `${Math.round(min / 1440)} d`;
  if (min >= 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  return `${Math.max(1, min)} min`;
}

/** Estado temporal de un agotado para mostrar: null si indefinido o ya venció. */
export function cronometroAgotado(agotadoHasta: string | null | undefined, ahoraMs: number): { minutos: number; hora: string } | null {
  if (esIndefinido(agotadoHasta)) return null;
  const t = new Date(agotadoHasta as string).getTime();
  if (t <= ahoraMs) return null;
  return { minutos: Math.ceil((t - ahoraMs) / 60_000), hora: horaLima(t) };
}
