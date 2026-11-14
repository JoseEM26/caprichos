/** «¿Para cuándo?» del Nuevo pedido (Caja y mozo): Ahora, Mañana u otra fecha con hora. Todo en hora de Lima (UTC-5, sin verano). */
export type ModoParaCuando = 'AHORA' | 'MANANA' | 'OTRA';

export interface ParaCuando {
  modo: ModoParaCuando;
  /** AAAA-MM-DD; con 'MANANA' se ignora (es el día siguiente a hoy). */
  fecha: string;
  /** HH:mm */
  hora: string;
}

/** Tope por defecto de días hacia adelante; el servidor tiene la última palabra (parámetro programado_dias_max). */
export const DIAS_MAX_PROGRAMADO = 7;

export const PARA_CUANDO_AHORA: ParaCuando = { modo: 'AHORA', fecha: '', hora: '' };

const LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

export const hoyLima = (ahora: Date = new Date()): string => LIMA.format(ahora);

export function sumarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Día elegido (AAAA-MM-DD) o null si es «Ahora». */
export function fechaElegida(v: ParaCuando, ahora: Date = new Date()): string | null {
  if (v.modo === 'AHORA') return null;
  return v.modo === 'MANANA' ? sumarDias(hoyLima(ahora), 1) : v.fecha || null;
}

/** Instante ISO (UTC) de la fecha y hora pactadas, o null si es «Ahora» o está incompleto. */
export function programadoParaIso(v: ParaCuando, ahora: Date = new Date()): string | null {
  const fecha = fechaElegida(v, ahora);
  if (!fecha || !/^\d{2}:\d{2}$/.test(v.hora)) return null;
  const d = new Date(`${fecha}T${v.hora}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mensaje de lo que falta o está mal (null = válido o «Ahora»). */
export function errorParaCuando(v: ParaCuando, ahora: Date = new Date(), diasMax: number = DIAS_MAX_PROGRAMADO): string | null {
  if (v.modo === 'AHORA') return null;
  if (v.modo === 'OTRA' && !v.fecha) return 'Elige la fecha del pedido.';
  if (!/^\d{2}:\d{2}$/.test(v.hora)) return 'Elige la hora a la que lo quieren.';
  const iso = programadoParaIso(v, ahora);
  if (!iso) return 'La fecha u hora no es válida.';
  if (new Date(iso).getTime() <= ahora.getTime()) return 'La hora elegida ya pasó.';
  if ((fechaElegida(v, ahora) as string) > sumarDias(hoyLima(ahora), diasMax)) return `Solo se puede programar hasta ${diasMax} días adelante.`;
  return null;
}

/** «sáb 14/11 · 08:00» (hora de Lima). */
export function textoProgramado(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: '2-digit', month: '2-digit' }).format(d).replace(',', '');
  const h = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${f} · ${h}`;
}
