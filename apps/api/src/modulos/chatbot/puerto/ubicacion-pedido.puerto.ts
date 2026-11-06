/** Ubicación de WhatsApp que el cliente envió, para asignarla a su pedido delivery. */
export interface UbicacionRecibida {
  telefono: string;
  lat: number;
  lng: number;
  /** Dirección escrita que viene con el pin (si viene) */
  direccion?: string;
}

export interface UbicacionPedidoPuerto {
  /** true si la ubicación se atendió como parte de un pedido delivery (el bot no debe procesarla otra vez). */
  recibir(u: UbicacionRecibida): Promise<{ atendida: boolean }>;
}

/** Token de inyección: lo implementa pedidos-admin y el webhook lo resuelve sin importar ese módulo (evita el ciclo). */
export const UBICACION_PEDIDO_PUERTO = 'UBICACION_PEDIDO_PUERTO';
