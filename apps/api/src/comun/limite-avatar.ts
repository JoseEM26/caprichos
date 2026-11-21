import { json, RequestHandler } from 'express';

export const RUTA_AVATAR_CLIENTE = '/carta/cuenta/avatar';

/**
 * El retrato del avatar (PNG de hasta 200 KB) viaja como data URL en el JSON: pesa ~270 KB y el límite global (100 kb)
 * respondería 413. Este parser va ANTES de los de Nest y solo en esa ruta. Se llama distinto de «jsonParser» a propósito
 * (ver limite-webhook-evolution.ts): con ese nombre Nest no registraría el parser global.
 */
export function parserAvatarCliente(): RequestHandler {
  const parser = json({ limit: '400kb' });
  return function parserCuerpoAvatarCliente(req, res, next) {
    return parser(req, res, next);
  };
}
