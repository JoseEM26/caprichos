const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Cómo se paga el pedido, para que Despacho vea todo de un vistazo: medios con su monto, estado del cobro
 * y si hay que llevar vuelto (efectivo recibido o declarado menos el efectivo del plan). Nunca datos de contacto.
 */
export function resumenPagoDespacho(p: {
  total: unknown;
  descuento?: unknown;
  propina?: unknown;
  pago_metodo?: string | null;
  pago_estado?: string | null;
  paga_con?: unknown;
  cobro_mozo_en?: Date | null;
  cobro_mozo_medio?: string | null;
  cobro_mozo_recibido?: unknown;
  planPago?: Array<{ medio: string; monto: unknown; orden?: number }>;
}) {
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
  const cobrado = p.pago_estado === 'PAGADO';
  return {
    estado: cobrado ? 'PAGADO' : p.cobro_mozo_en ? 'COBRADO_MOZO' : 'POR_COBRAR',
    medios,
    total: redondear(total),
    descuento: redondear(Number(p.descuento ?? 0)),
    propina: redondear(Number(p.propina ?? 0)),
    efectivo,
    recibido,
    vuelto,
    // true: lleva vuelto · false: sin vuelto · null: paga en efectivo pero no se sabe con cuánto
    llevaVuelto: efectivo > 0 ? (vuelto == null ? null : vuelto > 0) : false,
  };
}
