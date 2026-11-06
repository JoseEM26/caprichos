import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Enlace secreto de la pantalla del local (tablet sin cuenta). Se guarda solo el sha256 del token;
// el token en claro sale una única vez, al generarlo. Regenerar reemplaza el hash y deja inválido el anterior.

export const CLAVE_ENLACE_PANTALLA = 'asistencia.pantalla';

export interface EnlacePantalla {
  tokenHash: string;
  generadoEn: string;
}

export const generarTokenPantalla = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Compara en tiempo constante el hash guardado con el hash del token recibido. */
export function tokenCoincide(hashGuardado: string, token: string): boolean {
  const a = Buffer.from(hashGuardado);
  const b = Buffer.from(hashToken(token));
  return a.length === b.length && timingSafeEqual(a, b);
}
