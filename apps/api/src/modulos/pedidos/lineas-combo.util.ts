/**
 * Las partes de un combo son líneas hijas (linea_combo_id) para cocina y stock. La cuenta, los comprobantes,
 * los tickets y los conteos de productos usan solo la madre: esto las deja fuera.
 */
export function lineasDeCuenta<T>(lineas: T[]): T[] {
  return lineas.filter((l) => (l as { linea_combo_id?: unknown }).linea_combo_id == null);
}

/**
 * Lo que va al comprobante electrónico y al PDF: la cuenta sin las partes de combo y SIN las cortesías
 * (una cortesía no es venta: no entra a SUNAT ni a la boleta; el total del pedido ya la excluye).
 */
export function lineasParaComprobante<T>(lineas: T[]): T[] {
  return lineasDeCuenta(lineas).filter((l) => !(l as { es_cortesia?: boolean }).es_cortesia);
}
