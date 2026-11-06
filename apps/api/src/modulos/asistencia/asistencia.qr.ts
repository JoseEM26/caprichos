import { createHash, createHmac, timingSafeEqual } from 'crypto';

// QR de la pantalla del local: firmado con HMAC del servidor, cambia cada 30 s.
// Se aceptan la ranura actual y la anterior (latencia del celular). Sin estado en BD.

export const VENTANA_SEG = 30;
const PREFIJO = 'CAPRICHOS-ASIST';

/** Clave de firma derivada del secreto del servidor (mismo origen que los tokens de seguimiento). */
export function secretoQr(jwtSecret: string): string {
  return createHash('sha256').update(`asistencia-qr|${jwtSecret}`).digest('hex');
}

export function slotDe(ahoraMs: number): number {
  return Math.floor(ahoraMs / 1000 / VENTANA_SEG);
}

function hmacSlot(secreto: string, slot: number): string {
  return createHmac('sha256', secreto).update(`slot:${slot}`).digest('hex');
}

/** Código de 6 dígitos de la misma ranura, para escribirlo si la cámara falla. */
export function codigoCorto(secreto: string, slot: number): string {
  const n = parseInt(hmacSlot(secreto, slot).slice(0, 12), 16) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function payloadQr(secreto: string, slot: number): string {
  return `${PREFIJO}:${slot}:${hmacSlot(secreto, slot).slice(0, 32)}`;
}

function ranurasAceptadas(ahoraMs: number): number[] {
  const actual = slotDe(ahoraMs);
  return [actual, actual - 1];
}

function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Ranura del QR escaneado si es válido y vigente; null si no. */
export function verificarPayload(secreto: string, payload: string, ahoraMs: number): number | null {
  const partes = payload.trim().split(':');
  if (partes.length !== 3 || partes[0] !== PREFIJO || !/^\d{1,12}$/.test(partes[1])) return null;
  const slot = Number(partes[1]);
  if (!ranurasAceptadas(ahoraMs).includes(slot)) return null;
  return iguales(partes[2], hmacSlot(secreto, slot).slice(0, 32)) ? slot : null;
}

/** Ranura del código de 6 dígitos si coincide con la actual o la anterior; null si no. */
export function verificarCodigo(secreto: string, codigo: string, ahoraMs: number): number | null {
  const limpio = codigo.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;
  for (const slot of ranurasAceptadas(ahoraMs)) {
    if (iguales(limpio, codigoCorto(secreto, slot))) return slot;
  }
  return null;
}
