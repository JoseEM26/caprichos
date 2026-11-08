import { calcularPagoPedido, type EntradaPagoPedido } from '@caprichos/compartido';

/**
 * Cómo se paga el pedido, para que Despacho vea todo de un vistazo: medios con su monto, estado del cobro
 * y si hay que llevar vuelto. La regla vive en `calcularPagoPedido` (compartida con el sticker de despacho).
 */
export const resumenPagoDespacho = (p: EntradaPagoPedido) => calcularPagoPedido(p);
