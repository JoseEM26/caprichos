/**
 * Regla pura «¿este anuncio se muestra ahora a esta persona?». Todo en hora de Lima (UTC-5, sin horario de verano).
 * La vigencia, la franja y los días los decide el servidor; la frecuencia usa el historial de vistas de la persona
 * (en BD para el personal, en el navegador para la carta). La web tiene un espejo de `tocaPorFrecuencia`.
 */
export const PUBLICOS = ['CARTA', 'PERSONAL', 'AMBOS'] as const;
export const PLANTILLAS = ['NOVEDAD', 'PROMOCION', 'AVISO', 'EVENTO', 'SOLO_IMAGEN', 'BIENVENIDA', 'COMUNICADO_INTERNO'] as const;
export const FRECUENCIAS = ['UNA_VEZ', 'CADA_INGRESO', 'VECES_POR_DIA', 'CADA_N_HORAS'] as const;
export const COLORES = ['NAVY', 'CREMA', 'NARANJA', 'DORADO'] as const;
export const TIPOS_EVENTO = ['VISTA', 'CIERRE', 'CLIC', 'ENTENDIDO'] as const;
export const MAX_POR_INGRESO = 3;

export interface ReglaAnuncio {
  activo: boolean;
  desde: Date | null;
  hasta: Date | null;
  franja_desde: string | null;
  franja_hasta: string | null;
  dias_semana: number[];
  frecuencia: string;
  veces_por_dia: number;
  cada_horas: number | null;
}

const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

const SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Día de la semana en Lima: 0 = domingo … 6 = sábado. */
export const diaSemanaLima = (d: Date): number =>
  SEMANA[new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short' }).format(d)];

/** Minutos desde la medianoche en Lima. */
export function minutosLima(d: Date): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return n('hour') * 60 + n('minute');
}

const aMinutos = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Vigencia + días de la semana + franja horaria. No mira la frecuencia. */
export function vigenteAhora(a: ReglaAnuncio, ahora: Date = new Date()): boolean {
  if (!a.activo) return false;
  if (a.desde && ahora < a.desde) return false;
  if (a.hasta && ahora > a.hasta) return false;
  if (a.dias_semana?.length && !a.dias_semana.includes(diaSemanaLima(ahora))) return false;
  if (a.franja_desde && a.franja_hasta) {
    const t = minutosLima(ahora);
    const d = aMinutos(a.franja_desde);
    const h = aMinutos(a.franja_hasta);
    // Franja que cruza la medianoche (22:00 a 02:00)
    const dentro = d <= h ? t >= d && t < h : t >= d || t < h;
    if (!dentro) return false;
  }
  return true;
}

/** Frecuencia por persona. `vistas` = instantes en que ya vio este anuncio. */
export function tocaPorFrecuencia(
  a: Pick<ReglaAnuncio, 'frecuencia' | 'veces_por_dia' | 'cada_horas'>,
  vistas: Date[],
  ahora: Date = new Date(),
): boolean {
  switch (a.frecuencia) {
    case 'CADA_INGRESO':
      return true;
    case 'VECES_POR_DIA': {
      const hoy = diaLima(ahora);
      return vistas.filter((v) => diaLima(v) === hoy).length < Math.max(1, a.veces_por_dia || 1);
    }
    case 'CADA_N_HORAS': {
      const ms = Math.max(1, a.cada_horas || 1) * 3_600_000;
      return !vistas.some((v) => ahora.getTime() - v.getTime() < ms);
    }
    default: // UNA_VEZ
      return vistas.length === 0;
  }
}

export const seMuestraAhora = (a: ReglaAnuncio, vistas: Date[], ahora: Date = new Date()): boolean =>
  vigenteAhora(a, ahora) && tocaPorFrecuencia(a, vistas, ahora);

export type EstadoAnuncio = 'PROGRAMADO' | 'AL_AIRE' | 'VENCIDO' | 'APAGADO';

/** Estado para la lista del admin (ignora franja y días: «al aire» = dentro de la vigencia y encendido). */
export function estadoAnuncio(a: Pick<ReglaAnuncio, 'activo' | 'desde' | 'hasta'>, ahora: Date = new Date()): EstadoAnuncio {
  if (!a.activo) return 'APAGADO';
  if (a.hasta && ahora > a.hasta) return 'VENCIDO';
  if (a.desde && ahora < a.desde) return 'PROGRAMADO';
  return 'AL_AIRE';
}
