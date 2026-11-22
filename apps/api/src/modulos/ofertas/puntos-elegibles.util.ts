import type { DetalleDescuentoAplicado } from './ofertas.tipos';

interface LineaElegible {
  productoId: bigint | string;
  subtotal: number;
  noSumaBeneficios?: boolean;
  /** Línea de promoción o de combo: ya trae su propio descuento */
  enPromocion?: boolean;
  /** Qué tipo de promoción es (solo si enPromocion): permite que un interruptor la deje sumar */
  tipoPromo?: 'COMBO' | 'OFERTA';
}

/** Interruptores de operación: puntos_combos_suman y puntos_ofertas_suman (apagados por defecto) */
export interface PuntosPromoSuman {
  combos?: boolean;
  ofertas?: boolean;
}

/** Lee los dos interruptores; si el parámetro no existe o falla la lectura = apagado (como siempre). */
export async function leerPuntosPromoSuman(prisma: {
  parametro: { findMany: (args: any) => Promise<{ clave: string; valor: unknown }[]> };
}): Promise<PuntosPromoSuman> {
  try {
    const filas = await prisma.parametro.findMany({ where: { clave: { in: ['puntos_combos_suman', 'puntos_ofertas_suman'] } } });
    const on = (c: string) => {
      const v = filas?.find((f) => f.clave === c)?.valor;
      return v === true || String(v ?? '').toLowerCase() === 'si';
    };
    return { combos: on('puntos_combos_suman'), ofertas: on('puntos_ofertas_suman') };
  } catch {
    return {};
  }
}

/**
 * Aclaración corta de qué suma puntos, según los interruptores de Configuración › Puntos (para la invitación del bot):
 * todo suma → nada; nada de promos → «(en productos sin promo)»; solo una de las dos → qué queda fuera.
 */
export function aclaracionPuntos(suman?: PuntosPromoSuman): string {
  if (suman?.combos && suman?.ofertas) return '';
  if (suman?.combos) return ' (sin contar productos en oferta)';
  if (suman?.ofertas) return ' (sin contar combos)';
  return ' (en productos sin promo)';
}

/** ¿Esta línea de promoción queda fuera de los puntos con los interruptores dados? */
export function promoExcluyePuntos(l: { enPromocion?: boolean; tipoPromo?: 'COMBO' | 'OFERTA' }, suman?: PuntosPromoSuman): boolean {
  if (!l.enPromocion) return false;
  return !((l.tipoPromo === 'COMBO' && suman?.combos) || (l.tipoPromo === 'OFERTA' && suman?.ofertas));
}

/**
 * Parte del pedido sobre la que se ganan y se canjean puntos: solo productos sin descuento.
 * Quedan fuera los marcados «No suma puntos ni aplica cupones», los de promoción y los que
 * recibieron algún descuento o cupón (DT-55, DT-65).
 */
export function montoElegiblePuntos(
  lineas: LineaElegible[],
  detalles: Pick<DetalleDescuentoAplicado, 'lineasAfectadas'>[] | null | undefined,
  /** Solo para GANAR puntos: el canje y el descuento del personal no lo pasan y siguen excluyendo promociones */
  suman?: PuntosPromoSuman,
): number {
  const conDescuento = new Set<string>();
  for (const d of detalles ?? []) {
    for (const l of d.lineasAfectadas ?? []) conDescuento.add(String(l.productoId));
  }
  const total = lineas
    .filter((l) => !l.noSumaBeneficios && !promoExcluyePuntos(l, suman) && !conDescuento.has(String(l.productoId)))
    .reduce((acc, l) => acc + Number(l.subtotal), 0);
  return Number(total.toFixed(2));
}

type LineaGuardada = { oferta_id?: unknown; linea_combo_id?: unknown; producto_id?: unknown };

/** Línea madre de un combo guardada: lleva la oferta y el cobro, pero no tiene producto propio. */
export const esMadreCombo = (l: LineaGuardada): boolean => l.oferta_id != null && l.producto_id == null && l.linea_combo_id == null;

/** Tipo de promoción de una línea ya guardada del pedido (combo: madre o parte; oferta: línea suelta con oferta). */
export function tipoPromoLinea(l: LineaGuardada): 'COMBO' | 'OFERTA' | undefined {
  if (l.linea_combo_id != null || esMadreCombo(l)) return 'COMBO';
  return l.oferta_id != null ? 'OFERTA' : undefined;
}
