import { ConflictException } from '@nestjs/common';

export const MENSAJE_DELIVERY_SIN_UBICACION = 'Falta la ubicación del cliente: confírmala por WhatsApp antes de mandarlo con el motorizado';

type PedidoUbicable = {
  modalidad: string;
  entrega_lat?: unknown;
  entrega_lng?: unknown;
};

/** Un delivery está ubicado cuando tiene punto en el mapa (con el punto se calcula la zona y el envío). Otras modalidades no aplican. */
export function deliveryUbicado(p: PedidoUbicable): boolean {
  if (p.modalidad !== 'DELIVERY') return true;
  return p.entrega_lat != null && p.entrega_lng != null;
}

/** 409 UBICACION_REQUERIDA: un delivery sin ubicación pasa a cocina, pero no se asigna ni sale con el motorizado. */
export function exigirDeliveryUbicado(p: PedidoUbicable): void {
  if (!deliveryUbicado(p)) {
    throw new ConflictException({ codigo: 'UBICACION_REQUERIDA', mensaje: MENSAJE_DELIVERY_SIN_UBICACION });
  }
}
