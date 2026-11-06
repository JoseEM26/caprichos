/** Un pedido de salón puede ocupar de 1 a 6 mesas juntas (una sola cuenta). */
export const MAX_MESAS_PEDIDO = 6;

/**
 * «Mesa 3», «Mesas 3 y 4», «Mesas 3, 4 y 5»: mismo texto que la web (etiquetaMesas de SelectorMesasCroquis).
 * Es el nombre visible del pedido (pedido.mesa_nombre): ticket, cocina, comanda y listados.
 */
export function etiquetaMesasPedido(mesas: Array<{ numero?: number | null; nombre?: string | null }>): string {
  if (mesas.length === 0) return '';
  const nombres = mesas.map((m) => String(m.numero ?? m.nombre ?? '?'));
  const union =
    nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `${nombres.length === 1 ? 'Mesa' : 'Mesas'} ${union}`;
}

/** Nombre de una mesa sola: «Mesa 3» o su nombre libre. Igual que antes en pedido_mesa.mesa_nombre. */
export function nombreUnaMesa(m: { id: bigint; numero?: number | null; nombre?: string | null }): string {
  return m.numero ? `Mesa ${m.numero}` : m.nombre || `Mesa ${m.id}`;
}
