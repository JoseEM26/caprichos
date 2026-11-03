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

/** Enlace a la carta web con el seguimiento de ese pedido abierto. La carta web vive en la raíz (/). */
export function enlaceSeguimientoCarta(origen: string, codigo: string, pedidoId: bigint | string | number): string {
  return `${origen.replace(/\/$/, '')}/?seguimiento=${encodeURIComponent(codigo)}&t=${generarTokenSeguimiento(pedidoId)}`;
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
