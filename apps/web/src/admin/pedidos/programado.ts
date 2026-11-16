import type { Pedido } from './pedidosApi';
import { hoyLima, sumarDias } from './filtroDias';

/** Cuándo es un pedido programado, en lenguaje llano y en hora de Lima (para la tarjeta, la lista y el detalle). */

export type NivelProgramado = 'normal' | 'cerca' | 'vencido';

/** Minutos antes de la hora pactada desde los que el chip de HOY pasa a ámbar. */
export const MIN_CERCA = 120;

const f = (iso: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', ...o }).format(iso);

/** AAAA-MM-DD (Lima) de un instante. */
export const diaLima = (d: Date): string => hoyLima(d);

/** «5:00 p. m.» */
export const horaProgramado = (d: Date): string => f(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/[\u202f\u00a0]/g, ' ');

/** «17/11» */
const diaMes = (d: Date) => f(d, { day: '2-digit', month: '2-digit' });

/** «hoy» / «mañana» / «lunes 17/11» según el día pactado. */
export function etiquetaDia(d: Date, ahora: Date): string {
  const dia = diaLima(d);
  const hoy = diaLima(ahora);
  if (dia === hoy) return `hoy ${diaMes(d)}`;
  if (dia === sumarDias(hoy, 1)) return `mañana ${diaMes(d)}`;
  return `${f(d, { weekday: 'long' })} ${diaMes(d)}`;
}

/** «martes 17 de noviembre de 2026» */
export const fechaLarga = (d: Date): string => f(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');

/** «faltan 1 d 23 h», «faltan 2 h 10 min», «faltan 25 min»; pasada la hora, «vencido hace 15 min». */
export function textoFaltan(d: Date, ahora: Date): string {
  const min = Math.floor((d.getTime() - ahora.getTime()) / 60000);
  const dur = (m: number) => (m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
  return min >= 0 ? `faltan ${dur(min)}` : `vencido hace ${dur(-min)}`;
}

export interface ParaCuandoPedido {
  fecha: Date;
  /** «para mañana 17/11 · 5:00 p. m.» */
  cuando: string;
  /** «faltan 1 d 23 h» (solo mientras sigue PROGRAMADO) */
  faltan: string | null;
  nivel: NivelProgramado;
  /** Pactado para un día distinto de hoy (Lima) y aún PROGRAMADO */
  otroDia: boolean;
  /** Sigue en estado PROGRAMADO (aún no pasó a cocina o a la cola) */
  programado: boolean;
}

/** Null si el pedido no tiene fecha pactada. */
export function paraCuandoDe(p: Pick<Pedido, 'estado' | 'programado_para'>, ahora: Date = new Date()): ParaCuandoPedido | null {
  if (!p.programado_para) return null;
  const fecha = new Date(p.programado_para);
  if (Number.isNaN(fecha.getTime())) return null;
  const programado = String(p.estado || '').toUpperCase() === 'PROGRAMADO';
  const hoy = diaLima(fecha) === diaLima(ahora);
  const resta = fecha.getTime() - ahora.getTime();
  const nivel: NivelProgramado = programado && hoy ? (resta < 0 ? 'vencido' : resta <= MIN_CERCA * 60000 ? 'cerca' : 'normal') : 'normal';
  return {
    fecha,
    cuando: `para ${etiquetaDia(fecha, ahora)} · ${horaProgramado(fecha)}`,
    faltan: programado ? textoFaltan(fecha, ahora) : null,
    nivel,
    otroDia: programado && !hoy,
    programado,
  };
}

/** Programado para otro día (no hoy en Lima): va al final de Caja y no cuenta en el día. */
export const esProgramadoOtroDia = (p: Pick<Pedido, 'estado' | 'programado_para'>, ahora: Date = new Date()): boolean => !!paraCuandoDe(p, ahora)?.otroDia;

/** Separa los programados de otros días (ordenados por fecha pactada) del resto, conservando el orden del resto. */
export function separarProgramadosOtrosDias<T extends Pick<Pedido, 'estado' | 'programado_para'>>(lista: T[], ahora: Date = new Date()): { normales: T[]; otrosDias: T[] } {
  const normales: T[] = [];
  const otrosDias: T[] = [];
  for (const p of lista) (esProgramadoOtroDia(p, ahora) ? otrosDias : normales).push(p);
  otrosDias.sort((a, b) => new Date(a.programado_para as string).getTime() - new Date(b.programado_para as string).getTime());
  return { normales, otrosDias };
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** «Pagado completo S/ 29.00» o «Adelanto S/ 10.00 · Saldo S/ 19.00»; null si no hay nada que decir (ni pagado ni adelanto). */
export function textoPagoProgramado(p: Pick<Pedido, 'total' | 'pago_estado' | 'adelanto_total'>): string | null {
  const total = Number(p.total || 0);
  const adelanto = Number(p.adelanto_total || 0);
  if (String(p.pago_estado || '').toUpperCase() === 'PAGADO') return `Pagado completo ${soles(total)}`;
  if (adelanto > 0) return `Adelanto ${soles(adelanto)} · Saldo ${soles(Math.max(0, total - adelanto))}`;
  return `Sin pagar · Saldo ${soles(total)}`;
}
