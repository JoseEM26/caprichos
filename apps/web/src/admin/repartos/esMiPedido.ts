import type { PedidoReparto } from './repartosApi';

/**
 * ¿El pedido está asignado al usuario actual? Compara como texto: el id de party llega como string
 * desde la API y puede venir como número por el socket.
 */
export function esMiPedido(
  pedido: Pick<PedidoReparto, 'repartidor_party_id'>,
  partyId: string | null | undefined,
): boolean {
  return pedido.repartidor_party_id != null && partyId != null && String(pedido.repartidor_party_id) === String(partyId);
}
