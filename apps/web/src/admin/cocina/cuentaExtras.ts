/** Pedido (o comanda) que puede ser un extra enlazado a su original. */
export interface ConCuenta {
  pedidoId: string;
  /** Raíz de la cuenta: id del pedido original si este es un extra. */
  pedidoOrigenId?: string | null;
  creado_en: string;
}

export interface GrupoCuenta<T> {
  clave: string;
  /** El pedido original (o, si no está a la vista, el primer extra). */
  principal: T;
  /** Original primero y luego sus extras por hora. */
  partes: T[];
}

/** ÚNICA regla para juntar original + extras (Despacho y Cocina «Todas»): clave = pedidoOrigenId ?? pedidoId. Sin extras: un grupo por pedido. */
export function agruparPorCuenta<T extends ConCuenta>(items: T[]): GrupoCuenta<T>[] {
  const porClave = new Map<string, T[]>();
  for (const p of items) {
    const k = p.pedidoOrigenId ?? p.pedidoId;
    porClave.set(k, [...(porClave.get(k) ?? []).filter((x) => x.pedidoId !== p.pedidoId), p]);
  }
  return [...porClave.entries()].map(([clave, ps]) => {
    const partes = ps.sort((a, b) => Number(!!a.pedidoOrigenId) - Number(!!b.pedidoOrigenId) || new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
    return { clave, principal: partes[0], partes };
  });
}

/** «Pedido original» / «Extra N» según su posición en el grupo. */
export const etiquetaParte = (p: ConCuenta, i: number) => (p.pedidoOrigenId ? `Extra ${i}` : 'Pedido original');
