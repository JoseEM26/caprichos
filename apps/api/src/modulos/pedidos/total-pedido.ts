/**
 * Total de un pedido: subtotal - descuentos - puntos canjeados + envío (1 punto = S/ 1). Los puntos NO van en
 * `pedido.descuento` (columna de promos/cupón/personal), pero sí restan al total y al comprobante. Todo sitio que
 * recalcule el total de un pedido existente debe pasar por aquí, o el canje se pierde en silencio.
 */
export function totalPedido(p: { subtotal: unknown; descuento?: unknown; envio?: unknown; puntosCanjeados?: unknown }): number {
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return Number(Math.max(0, n(p.subtotal) - n(p.descuento) - n(p.puntosCanjeados) + n(p.envio)).toFixed(2));
}

/** Descuento total para el comprobante electrónico: descuentos + puntos canjeados (el total del pedido ya es neto). */
export function descuentoParaComprobante(pedido: { descuento?: unknown; puntos_canjeados?: unknown }): number {
  return Number(((Number(pedido.descuento ?? 0) || 0) + (Number(pedido.puntos_canjeados ?? 0) || 0)).toFixed(2));
}
