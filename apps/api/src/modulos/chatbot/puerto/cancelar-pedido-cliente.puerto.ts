/** El cliente cancela su pedido desde WhatsApp. Lo implementa pedidos-admin; el bot lo resuelve sin importar ese módulo (evita el ciclo). */
export interface CancelarPedidoClientePuerto {
  /** Pedidos recientes de ese celular con su veredicto (el más nuevo primero). */
  evaluarPorTelefono(telefono: string): Promise<{ id: string; codigo: string; cancelable: boolean; mensaje?: string }[]>;
  /** Cancela solo si el pedido es de ese celular y sigue siendo cancelable; si no, lanza 403/404/409. */
  cancelarPorTelefono(codigo: string, telefono: string, motivo?: string): Promise<{ codigo: string }>;
}

export const CANCELAR_PEDIDO_CLIENTE_PUERTO = 'CANCELAR_PEDIDO_CLIENTE_PUERTO';
