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

/**
 * Nota que debe ver quien prepara una línea. La nota que escribe el cliente va en la línea MADRE del combo
 * (sin área: cocina solo ve las hijas), así que cada parte hereda los trozos de la nota de su madre que no trae ya.
 */
export function notaDeLinea(
  l: { linea_combo_id?: unknown; nota?: string | null },
  todas: Array<{ id?: unknown; nota?: string | null }>,
): string | null {
  const propia = (l.nota ?? '').trim();
  if (l.linea_combo_id == null) return propia || null;
  const madre = todas.find((m) => m.id != null && String(m.id) === String(l.linea_combo_id));
  const trozos = propia ? propia.split(' · ') : [];
  for (const t of (madre?.nota ?? '').split(' · ').map((x) => x.trim()).filter(Boolean)) if (!trozos.includes(t)) trozos.push(t);
  return trozos.join(' · ') || null;
}
