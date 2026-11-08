/** «Pedido extra»: el original (y sus extras) en el detalle y la lista. */
export const INCLUIR_EXTRAS = {
  pedidoOrigen: { select: { id: true, codigo: true } },
  extras: {
    select: { id: true, codigo: true, estado: true, pago_estado: true, total: true },
    orderBy: { id: 'asc' as const },
  },
};

/** Lista de extras y «total con extras» (suma solo los vigentes: sin anulados ni rechazados). Sin extras: no agrega nada. */
export function resumenExtras(p: { total: unknown; pedidoOrigen?: { id: bigint; codigo: string } | null; extras?: { id: bigint; codigo: string; estado: string; pago_estado: string | null; total: unknown }[] }) {
  const extras = (p.extras ?? []).map((e) => ({ id: String(e.id), codigo: e.codigo, estado: e.estado, pago_estado: e.pago_estado, total: Number(e.total) }));
  const vigentes = extras.filter((e) => e.estado !== 'ANULADO' && e.estado !== 'RECHAZADO');
  return {
    pedido_origen: p.pedidoOrigen ? { id: String(p.pedidoOrigen.id), codigo: p.pedidoOrigen.codigo } : null,
    extras,
    total_con_extras: extras.length > 0 ? Number((Number(p.total) + vigentes.reduce((a, e) => a + e.total, 0)).toFixed(2)) : null,
  };
}
