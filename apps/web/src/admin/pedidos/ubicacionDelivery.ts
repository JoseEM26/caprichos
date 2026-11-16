/** Mismo texto que el servidor (409 UBICACION_REQUERIDA). */
export const MENSAJE_DELIVERY_SIN_UBICACION = 'Falta la ubicación del cliente: confírmala por WhatsApp antes de mandarlo con el motorizado';

/** Marca corta para tarjetas y listas. */
export const MARCA_FALTA_UBICACION = '📍 Falta ubicación';

interface PedidoUbicable {
  modalidad?: string | null;
  entrega_lat?: number | string | null;
  entrega_lng?: number | string | null;
}

/**
 * Delivery sin punto: pasa a cocina igual, pero no sale con el motorizado (el servidor lo rechaza
 * con 409 UBICACION_REQUERIDA). Un dato que el listado no trae (undefined) no cuenta como falta: decide el servidor.
 */
export function deliverySinUbicacion(p: PedidoUbicable): boolean {
  if ((p.modalidad || '').toUpperCase() !== 'DELIVERY') return false;
  return (p.entrega_lat !== undefined && p.entrega_lat == null) || (p.entrega_lng !== undefined && p.entrega_lng == null);
}
