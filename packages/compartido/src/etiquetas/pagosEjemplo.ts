import { calcularPagoPedido } from './pagoPedido.js';
import type { PagoEtiqueta } from '../tipos/etiquetas.js';

/** Los 5 pagos de ejemplo del sticker de despacho (vista previa, simulacion y pruebas); salen de la misma funcion que el pedido real. */
export const PAGOS_EJEMPLO: Record<'digital' | 'efectivoVuelto' | 'dividido' | 'personal' | 'deliveryContraEntrega', PagoEtiqueta> = {
  digital: calcularPagoPedido({ total: 38.5, pago_metodo: 'YAPE', pago_estado: 'PAGADO' }),
  efectivoVuelto: calcularPagoPedido({ total: 38.5, pago_metodo: 'EFECTIVO', pago_estado: 'PENDIENTE', paga_con: 50, propina: 2 }),
  dividido: calcularPagoPedido({ total: 38.5, pago_estado: 'PAGADO', descuento: 4, planPago: [{ medio: 'EFECTIVO', monto: 20, orden: 1 }, { medio: 'YAPE', monto: 18.5, orden: 2 }], paga_con: 20 }),
  personal: calcularPagoPedido({ total: 21, es_personal: true, pago_metodo: 'CREDITO_PERSONAL', descuento: 9 }),
  deliveryContraEntrega: calcularPagoPedido({ total: 38.5, modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', pago_estado: 'PENDIENTE', paga_con: 100 }),
};
