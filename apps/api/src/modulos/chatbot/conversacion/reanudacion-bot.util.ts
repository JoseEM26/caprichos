/**
 * Reanudación diaria del bot: si una persona intervino un chat el día D (hora de Lima), el bot no responde
 * ese chat el resto del día D y vuelve a las 00:01 de Lima del día D+1. Lima no tiene horario de verano (UTC-5).
 */
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const MIN_REANUDA = 1; // 00:01

/** Instante (UTC) de las 00:01 de Lima del día siguiente a la última intervención humana. */
export function botPausadoHasta(ultimaIntervencionHumana: Date): Date {
  const lima = new Date(ultimaIntervencionHumana.getTime() - LIMA_OFFSET_MS);
  const siguiente = Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() + 1, 0, MIN_REANUDA);
  return new Date(siguiente + LIMA_OFFSET_MS);
}

/** Fecha de Lima (YYYY-MM-DD) de un instante: sirve de candado diario. */
export function diaLima(fecha: Date): string {
  return new Date(fecha.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutos transcurridos desde las 00:00 de Lima (0 = 00:00). */
export function minutoDelDiaLima(fecha: Date): number {
  const l = new Date(fecha.getTime() - LIMA_OFFSET_MS);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
}

/** La última intervención humana es la más reciente entre el último mensaje de una persona y el momento de tomar el chat. */
export function ultimaIntervencionHumana(...instantes: Array<Date | string | null | undefined>): Date | null {
  const validos = instantes
    .filter((i): i is Date | string => i != null)
    .map((i) => new Date(i))
    .filter((d) => !isNaN(d.getTime()));
  return validos.length ? new Date(Math.max(...validos.map((d) => d.getTime()))) : null;
}

/** true si el bot sigue pausado por una intervención humana de hoy. */
export function botPausadoPorPersona(ultimaIntervencion: Date | null, ahora: Date = new Date()): boolean {
  return ultimaIntervencion != null && ahora.getTime() < botPausadoHasta(ultimaIntervencion).getTime();
}

/**
 * El saludo de bienvenida con menú solo va en la primera conversación o tras días sin hablar.
 * Nunca si hay pedido de hoy, el chat fue marcado Atendido, una persona lo tomó hoy o el bot/equipo escribió hace menos de 24 h
 * (tras la reanudación de las 00:01 también cuenta haber hablado ayer).
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
