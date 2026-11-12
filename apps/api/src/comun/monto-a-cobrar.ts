/**
 * Lo que HAY QUE COBRAR de un pedido (sin propina), en pesos. Criterio único.
 * Un pedido de un trabajador con crédito del personal y delivery lleva `monto_credito` (productos con su descuento, a su
 * crédito de fin de mes): lo que se cobra al contado es solo el resto (el envío). En todo otro pedido monto_credito = 0
 * y se cobra el total. Si el envío aún no está definido (por confirmar), el total no lo incluye y no hay nada que cobrar.
 * Ojo: quien consulta con `select` explícito debe pedir `monto_credito`, o se verá el total completo.
 */
export function montoACobrar(p: { total: unknown; monto_credito?: unknown }): number {
  const cents = Math.round(Number(p.total ?? 0) * 100) - Math.round(Number(p.monto_credito ?? 0) * 100);
  return Math.max(0, cents) / 100;
}
