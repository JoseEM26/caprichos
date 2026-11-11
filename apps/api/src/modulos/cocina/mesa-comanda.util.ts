/**
 * Texto de mesa de un pedido para Cocina, Despacho e Historial: «Mesa 6», «Mesas 4 y 5».
 * Sale de pedido.mesa_nombre (lo que el salón ya guarda); para pedidos viejos cae en entrega_referencia.
 * Solo pedidos de mesa o de comer en el local; el resto devuelve null.
 */
export function mesaDePedido(p: {
  modalidad: string;
  mesa_nombre?: string | null;
  entrega_referencia?: string | null;
}): string | null {
  if (p.modalidad !== 'MESA' && p.modalidad !== 'COMER_LOCAL') return null;
  const nombre = p.mesa_nombre?.trim();
  if (nombre) return nombre;
  return p.modalidad === 'MESA' ? (p.entrega_referencia?.trim() || null) : null;
}
