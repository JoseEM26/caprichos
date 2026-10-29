/**
 * Canales donde pedido.party_id es el propio cliente cuando no hay cliente_party_id.
 * En MOZO y CAJA party_id es el party del personal que abrió el pedido, nunca el cliente.
 */
export const CANALES_CLIENTE_EN_PARTY = ['CARTA', 'WHATSAPP', 'BOT'];

/** Cliente con cuenta de un pedido (null = invitado). Úsalo en vez de leer party_id como cliente. */
export function partyClienteDelPedido(pedido: {
  canal: string;
  party_id: bigint | null;
  cliente_party_id?: bigint | null;
}): bigint | null {
  if (pedido.cliente_party_id) return pedido.cliente_party_id;
  if (pedido.party_id && CANALES_CLIENTE_EN_PARTY.includes(pedido.canal)) return pedido.party_id;
  return null;
}
