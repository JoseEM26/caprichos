/**
 * Pedido de «Tarjeta / Yape en línea» que todavía espera el pago del cliente: no va a cocina ni se cobra a mano.
 * El camino legítimo (aprobación de Culqi) escribe con prisma directo; estas reglas frenan a Caja, al ADMIN y a los cambios de estado.
 */
export const CODIGO_PAGO_ONLINE_PENDIENTE = 'PAGO_ONLINE_PENDIENTE';
export const MENSAJE_PAGO_ONLINE_PENDIENTE = 'Este pedido espera el pago en línea del cliente. Pasa a cocina solo cuando pague.';

export function esPendienteDePagoOnline(p: { estado?: string | null; pago_estado?: string | null }): boolean {
  if (p.estado === 'ANULADO') return false;
  return p.estado === 'POR_PAGAR' || p.pago_estado === 'PENDIENTE_ONLINE';
}
