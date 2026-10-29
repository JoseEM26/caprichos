/**
 * Regla de cambio de voucher (pura, sin acceso a BD). La usan el servidor (subirYProcesar, quitar,
 * historial, misPedidos); la web solo lee los booleanos que devuelve la API.
 *
 * Regla vigente: el MOZO puede subir, cambiar o quitar su voucher mientras Caja NO haya aprobado,
 * coordinado ni cobrado el pago (pago_estado PENDIENTE). Que el pedido esté en cola o en cocina no
 * bloquea: el pedido del mozo nace en COLA y va directo a cocina. Una vez que Caja aprobó el pago,
 * solo CAJERO y ADMIN pueden cambiarlo (con motivo y confirmación) hasta que quede PAGADO.
 * Nada se elimina: el anterior queda reemplazado o retirado y sigue en el historial.
 */

export interface PedidoRegloVoucher {
  estado: string;
  modalidad: string;
  pago_metodo?: string | null;
  pago_estado?: string | null;
  pago_coordinado_en?: Date | string | null;
}

/** Caja no ha aprobado, coordinado ni cobrado el pago del pedido. */
export function pagoPendiente(p: PedidoRegloVoucher): boolean {
  return (p.pago_estado ?? 'PENDIENTE') === 'PENDIENTE' && p.pago_coordinado_en == null;
}

/**
 * ¿Puede este rol REEMPLAZAR o QUITAR un voucher del pedido?
 * - MOZO: mientras el pago esté pendiente y el pedido no esté anulado. Cola, preparando o listo no bloquean.
 * - CAJERO y ADMIN (y cualquier otro rol con vouchers/subir): mientras el pago no esté cobrado (PAGADO).
 */
export function puedeCambiarVoucher(p: PedidoRegloVoucher, rol: string): boolean {
  if (rol === 'MOZO') return pagoPendiente(p) && p.estado !== 'ANULADO';
  return p.pago_estado !== 'PAGADO';
}

/** ¿Puede este rol SUBIR el primer voucher del pedido? Misma regla que cambiar, para el mozo. */
export function puedeSubirVoucher(p: PedidoRegloVoucher, rol: string): boolean {
  if (rol === 'MOZO') return pagoPendiente(p) && p.estado !== 'ANULADO';
  return p.pago_estado !== 'PAGADO';
}
