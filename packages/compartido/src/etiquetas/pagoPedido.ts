import type { PagoEtiqueta } from '../tipos/etiquetas.js';

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Entrada: los campos de pago de un pedido tal como vienen de la base (los Decimal llegan como número, texto o Decimal). */
export interface EntradaPagoPedido {
  total: unknown;
  descuento?: unknown;
  propina?: unknown;
  pago_metodo?: string | null;
  pago_estado?: string | null;
  paga_con?: unknown;
  cobro_mozo_en?: Date | string | null;
  cobro_mozo_medio?: string | null;
  cobro_mozo_recibido?: unknown;
  es_personal?: boolean | null;
  modalidad?: string | null;
  planPago?: Array<{ medio: string; monto: unknown; orden?: number }>;
}

/**
 * Fuente unica de verdad del bloque de pago: la usan el sticker de despacho, la pantalla de Despacho y (via el
 * API) el resumen del pedido. Medios con su monto (pago dividido = uno por medio), estado, vuelto y, en delivery
 * sin pagar, cuanto cobrar en efectivo al entregar.
 */
export function calcularPagoPedido(p: EntradaPagoPedido): PagoEtiqueta {
  const total = Number(p.total ?? 0);
  const plan = [...(p.planPago ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const medios = plan.length
    ? plan.map((x) => ({ medio: x.medio, monto: redondear(Number(x.monto)) }))
    : p.pago_metodo
      ? [{ medio: p.pago_metodo, monto: redondear(total) }]
      : [];
  const efectivo = redondear(medios.filter((m) => m.medio === 'EFECTIVO').reduce((a, m) => a + m.monto, 0));
  const recibidoRaw = p.cobro_mozo_recibido ?? p.paga_con;
  const recibido = recibidoRaw != null ? Number(recibidoRaw) : null;
  const vuelto = efectivo > 0 && recibido != null ? Math.max(0, redondear(recibido - efectivo)) : null;
  const esPersonal = Boolean(p.es_personal) || medios.some((m) => m.medio === 'CREDITO_PERSONAL');
  const estado = p.pago_estado === 'PAGADO' ? 'PAGADO' : p.cobro_mozo_en ? 'COBRADO_MOZO' : 'POR_COBRAR';
  const delivery = String(p.modalidad ?? '').toUpperCase() === 'DELIVERY';
  // Delivery sin pagar: el repartidor cobra el efectivo (si no se sabe el medio, todo el total)
  const cobrar = delivery && estado === 'POR_COBRAR' && !esPersonal ? (efectivo > 0 ? efectivo : medios.length === 0 ? redondear(total) : null) : null;
  return {
    estado,
    medios,
    total: redondear(total),
    descuento: redondear(Number(p.descuento ?? 0)),
    propina: redondear(Number(p.propina ?? 0)),
    efectivo,
    recibido,
    vuelto,
    // true: lleva vuelto · false: sin vuelto · null: paga en efectivo pero no se sabe con cuanto
    llevaVuelto: efectivo > 0 ? (vuelto == null ? null : vuelto > 0) : false,
    esPersonal,
    cobrarAlEntregar: cobrar,
  };
}
