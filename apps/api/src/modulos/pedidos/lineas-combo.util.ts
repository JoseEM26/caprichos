/**
 * Las partes de un combo son líneas hijas (linea_combo_id) para cocina y stock. La cuenta, los comprobantes,
 * los tickets y los conteos de productos usan solo la madre: esto las deja fuera.
 */
export function lineasDeCuenta<T>(lineas: T[]): T[] {
  return lineas.filter((l) => (l as { linea_combo_id?: unknown }).linea_combo_id == null);
}
