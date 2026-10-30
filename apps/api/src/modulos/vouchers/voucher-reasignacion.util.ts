/** Medios que llevan voucher (pago digital). */
export const MEDIOS_CON_VOUCHER = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Últimos 9 dígitos del celular; vacío si no hay un número usable. */
export function ultimos9(telefono: string | null | undefined): string {
  const d = String(telefono || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

/** Un pedido puede recibir un voucher si es digital, sigue sin pagar y no está cerrado. */
export function pedidoAceptaVoucher(p: {
  estado: string;
  pago_estado: string | null;
  pago_preferido: string | null;
  pago_metodo: string | null;
  es_personal?: boolean;
}): boolean {
  const medio = String(p.pago_preferido || p.pago_metodo || '').toUpperCase();
  return (
    MEDIOS_CON_VOUCHER.includes(medio) &&
    p.pago_estado === 'PENDIENTE' &&
    p.estado !== 'ANULADO' &&
    p.estado !== 'ENTREGADO' &&
    !p.es_personal
  );
}

/** Mismo cliente: mismo celular (últimos 9 dígitos). Sin celular en ambos lados no se puede confirmar. */
export function mismoCliente(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = ultimos9(a);
  return x.length === 9 && x === ultimos9(b);
}
