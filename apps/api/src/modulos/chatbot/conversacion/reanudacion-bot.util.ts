/**
 * Regla de silencio del bot tras atender una persona: calla mientras el equipo conversa y vuelve cuando nadie del equipo
 * escribió en ese chat durante `bot_reanuda_min` minutos (por defecto 20). Lima no tiene horario de verano (UTC-5).
 */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
export const PARAM_BOT_REANUDA_MIN = 'bot_reanuda_min';
export const BOT_REANUDA_MIN_DEFECTO = 20;

/** Fecha de Lima (YYYY-MM-DD) de un instante: sirve de candado diario. */
export function diaLima(fecha: Date): string {
  return new Date(fecha.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** La última intervención humana es la más reciente entre el último mensaje de una persona y el momento de tomar el chat. */
export function ultimaIntervencionHumana(...instantes: Array<Date | string | null | undefined>): Date | null {
  const validos = instantes
    .filter((i): i is Date | string => i != null)
    .map((i) => new Date(i))
    .filter((d) => !isNaN(d.getTime()));
  return validos.length ? new Date(Math.max(...validos.map((d) => d.getTime()))) : null;
}

/** true si el bot sigue callado: el equipo escribió hace menos de `esperaMin` minutos. */
export function botPausadoPorPersona(ultimaIntervencion: Date | null, ahora: Date = new Date(), esperaMin = BOT_REANUDA_MIN_DEFECTO): boolean {
  return ultimaIntervencion != null && ahora.getTime() - ultimaIntervencion.getTime() < esperaMin * 60_000;
}

/**
 * El saludo de bienvenida con menú solo va en la primera conversación o tras días sin hablar.
 * Nunca si hay pedido de hoy, el chat fue marcado Atendido, una persona lo tomó hoy o el bot/equipo escribió hace menos de 24 h
 * (tras reanudarlo también cuenta haber hablado ayer).
 */
export function debeOmitirBienvenida(d: {
  ahora?: Date;
  pedidosHoy?: number;
  estadoConversacion?: string | null;
  ultimaIntervencionHumana?: Date | null;
  ultimoMensajeSaleEn?: Date | null;
  reanudadoEn?: string | null;
}): boolean {
  const ahora = d.ahora ?? new Date();
  if ((d.pedidosHoy ?? 0) > 0 || d.estadoConversacion === 'ATENDIDA') return true;
  if (d.ultimaIntervencionHumana && diaLima(d.ultimaIntervencionHumana) === diaLima(ahora)) return true;
  const ult = d.ultimoMensajeSaleEn;
  if (!ult) return false; // primera conversación
  if (ahora.getTime() - ult.getTime() < 24 * 3600 * 1000) return true;
  return Boolean(d.reanudadoEn) && diaLima(new Date(ahora.getTime() - 24 * 3600 * 1000)) === diaLima(ult);
}
