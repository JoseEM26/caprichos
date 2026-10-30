import { createHmac, timingSafeEqual } from 'crypto';

// Dev fallback igual al de validarEntorno (fuera de desarrollo JWT_SECRET es obligatorio).
const SECRETO_DESARROLLO = 'solo-desarrollo-cambiar-en-produccion';

export function secretoSeguimiento(): string {
  return process.env.JWT_SECRET || SECRETO_DESARROLLO;
}

export function generarTokenSeguimiento(
  pedidoId: bigint | string | number,
  secreto: string = secretoSeguimiento(),
): string {
  return createHmac('sha256', secreto).update(`seg:${pedidoId}`).digest('hex');
}

export function verificarTokenSeguimiento(
  pedidoId: bigint | string | number,
  token: string | undefined,
  secreto: string = secretoSeguimiento(),
): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const esperado = Buffer.from(generarTokenSeguimiento(pedidoId, secreto));
  const recibido = Buffer.from(token);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
