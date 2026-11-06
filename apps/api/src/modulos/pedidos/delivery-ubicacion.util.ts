import { ConflictException } from '@nestjs/common';

export const MENSAJE_DELIVERY_SIN_UBICACION = 'Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).';

type PedidoUbicable = {
  modalidad: string;
  entrega_lat?: unknown;
  entrega_lng?: unknown;
  zona_id?: unknown;
};

/** Un delivery está ubicado cuando tiene punto Y zona (sin zona no hay envío calculado). Otras modalidades no aplican. */
export function deliveryUbicado(p: PedidoUbicable): boolean {
  if (p.modalidad !== 'DELIVERY') return true;
  return p.entrega_lat != null && p.entrega_lng != null && p.zona_id != null;
}

/** 409 DELIVERY_SIN_UBICACION: no se confirma, cobra ni manda a cocina un delivery sin ubicación. */
export function exigirDeliveryUbicado(p: PedidoUbicable): void {
  if (!deliveryUbicado(p)) {
    throw new ConflictException({ codigo: 'DELIVERY_SIN_UBICACION', mensaje: MENSAJE_DELIVERY_SIN_UBICACION });
  }
}

/** Fragmento de `where` de Prisma: delivery sin punto o sin zona (para excluirlo de cocina). */
export const DELIVERY_SIN_UBICACION_WHERE = {
  modalidad: 'DELIVERY',
  OR: [{ entrega_lat: null }, { entrega_lng: null }, { zona_id: null }],
} as const;
