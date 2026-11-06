/** Mismo texto que el servidor (409 DELIVERY_SIN_UBICACION). */
export const MENSAJE_DELIVERY_SIN_UBICACION = 'Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).';

interface PedidoUbicable {
  modalidad?: string | null;
  entrega_lat?: number | string | null;
  entrega_lng?: number | string | null;
  zona?: unknown;
  zona_id?: unknown;
}

/**
 * Delivery sin punto o sin zona: no se confirma, cobra ni manda a cocina (el servidor lo rechaza igual con 409
 * DELIVERY_SIN_UBICACION). Un dato que el listado no trae (undefined) no cuenta como falta: decide el servidor.
 */
export function deliverySinUbicacion(p: PedidoUbicable): boolean {
  if ((p.modalidad || '').toUpperCase() !== 'DELIVERY') return false;
  const sinPunto = (p.entrega_lat !== undefined && p.entrega_lat == null) || (p.entrega_lng !== undefined && p.entrega_lng == null);
  const zonaConocida = p.zona !== undefined || p.zona_id !== undefined;
  const sinZona = zonaConocida && !p.zona && (p.zona_id == null || p.zona_id === '');
  return sinPunto || sinZona;
}
