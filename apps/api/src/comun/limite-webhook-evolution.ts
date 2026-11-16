import { json, RequestHandler } from 'express';

export const RUTA_WEBHOOK_EVOLUTION = '/whatsapp/evolution/webhook';

/** Límite del cuerpo del webhook de Evolution en MB (EVOLUTION_WEBHOOK_MAX_MB, 25 por defecto). */
export function limiteWebhookEvolutionMb(valor?: string | number | null): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/**
 * Evolution entrega fotos y audios en base64 y el historial al vincular: el límite global (100 kb) responde 413 y se pierden
 * (p. ej. el voucher). Este parser va ANTES de los de Nest y solo en la ruta del webhook; el resto sigue con el límite normal.
 * Guarda rawBody como hace Nest.
 */
export function parserWebhookEvolution(mb: number): RequestHandler {
  const parser = json({
    limit: `${mb}mb`,
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  });
  // OJO: NO devolver `parser` directo. Nest decide si registra su parser JSON global buscando una capa llamada
  // «jsonParser» en el router de Express; si la encuentra (aunque esté montada solo en esta ruta), NO registra el global y
  // ningún otro endpoint recibe el cuerpo (el 16/11 dejó sin login a todos). Con otro nombre, Nest registra el suyo.
  return function parserCuerpoWebhookEvolution(req, res, next) {
    return parser(req, res, next);
  };
}
