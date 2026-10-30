/**
 * Estados internos del subflujo de cambios después del pedido (Ola 3, Agente E).
 */
export type EstadoCambiosFlujo =
  | 'CAMBIO_OPCIONES'
  | 'CAMBIO_DIR_UBICACION'
  | 'CAMBIO_DIR_REFERENCIA'
  | 'CAMBIO_DIR_CONFIRMAR'
  | 'CAMBIO_PED_DETALLE'
  | 'CAMBIO_PED_CONFIRMAR'
  | 'CAMBIO_NO_PERMITIDO';

/**
 * Datos acumulados durante la solicitud de cambio de pedido o dirección.
 */
export interface DatosCambioBot {
  pedidoId: string;
  pedidoCodigo: string;
  tipo: 'DIRECCION' | 'PEDIDO' | 'CANCELAR';
  modalidad: string;
  estadoPedido: string;
  direccionNueva?: string;
  referenciaNueva?: string;
  lat?: number;
  lng?: number;
  zonaId?: string;
  zonaNombre?: string;
  tarifaActual?: number;
  tarifaNueva?: number;
  recargo?: number;
  detalleTexto?: string;
}

/**
 * Estructura del subflujo de cambios almacenada dentro de `conversacion.flujo.cambios`.
 */
export interface EstadoFlujoCambios {
  estadoInterno: EstadoCambiosFlujo;
  datos: DatosCambioBot;
}
