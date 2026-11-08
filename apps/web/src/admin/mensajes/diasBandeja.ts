import { diaLima, etiquetaDia } from './fechasChat';
import { ChatResumen } from './mensajesTipos';

/** Filtro de día de la bandeja: «todos», «hoy», «ayer», «manana» o un día de Lima «2026-11-07» (cualquiera, también futuro). */
export type FiltroDia = 'todos' | 'hoy' | 'ayer' | 'manana' | string;

/** Día de Lima de la última actividad del chat (sin fecha = hoy). */
export const diaDeChat = (c: ChatResumen, ahora = new Date()): string => diaLima(c.fecha ? new Date(c.fecha) : ahora);

export function diaDelFiltro(f: FiltroDia, ahora = new Date()): string | null {
  if (f === 'todos') return null;
  if (f === 'hoy') return diaLima(ahora);
  if (f === 'ayer') return diaLima(new Date(ahora.getTime() - 86400000));
  if (f === 'manana') return diaLima(new Date(ahora.getTime() + 86400000)); // Lima no cambia de hora: +24 h es el día siguiente
  return f;
}

export const filtrarPorDia = (chats: ChatResumen[], f: FiltroDia, ahora = new Date()): ChatResumen[] => {
  const dia = diaDelFiltro(f, ahora);
  return dia ? chats.filter((c) => diaDeChat(c, ahora) === dia) : chats;
};

/** Orden de la cola: día más reciente primero y, dentro del día, urgentes y luego el que más espera. */
export const ordenarCola = (chats: ChatResumen[], ahora = new Date()): ChatResumen[] =>
  [...chats].sort(
    (a, b) =>
      diaDeChat(b, ahora).localeCompare(diaDeChat(a, ahora)) ||
      Number(b.urgente) - Number(a.urgente) ||
      (typeof b.esperaMin === 'number' ? b.esperaMin : -1) - (typeof a.esperaMin === 'number' ? a.esperaMin : -1),
  );

/** Para el estado vacío: «No hay mensajes para hoy / ayer / mañana / el sábado 7 de noviembre». */
export function textoVacioDia(f: FiltroDia, ahora = new Date()): string {
  if (f === 'hoy' || f === 'ayer') return `No hay mensajes para ${f}`;
  if (f === 'manana') return 'No hay mensajes para mañana';
  const dia = diaDelFiltro(f, ahora);
  if (!dia) return 'No hay mensajes';
  const t = encabezadoDia(dia, ahora);
  return `No hay mensajes para el ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

/** Encabezado de día: «Hoy», «Ayer» o «Sábado 7 de noviembre». */
export const encabezadoDia = (dia: string, ahora = new Date()) => etiquetaDia(`${dia}T12:00:00-05:00`, ahora);
