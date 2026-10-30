import type { DetalleDescuentoAplicado } from './ofertas.tipos';

interface LineaElegible {
  productoId: bigint | string;
  subtotal: number;
  noSumaBeneficios?: boolean;
  /** Línea de promoción o de combo: ya trae su propio descuento */
  enPromocion?: boolean;
}

/**
 * Parte del pedido sobre la que se ganan y se canjean puntos: solo productos sin descuento.
 * Quedan fuera los marcados «No suma puntos ni aplica cupones», los de promoción y los que
 * recibieron algún descuento o cupón (DT-55, DT-65).
 */
export function montoElegiblePuntos(
  lineas: LineaElegible[],
  detalles: Pick<DetalleDescuentoAplicado, 'lineasAfectadas'>[] | null | undefined,
): number {
  const conDescuento = new Set<string>();
  for (const d of detalles ?? []) {
    for (const l of d.lineasAfectadas ?? []) conDescuento.add(String(l.productoId));
  }
  const total = lineas
    .filter((l) => !l.noSumaBeneficios && !l.enPromocion && !conDescuento.has(String(l.productoId)))
    .reduce((acc, l) => acc + Number(l.subtotal), 0);
  return Number(total.toFixed(2));
}
