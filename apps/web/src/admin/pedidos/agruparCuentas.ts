/**
 * «Cuenta» = pedido original + sus extras (pedido.pedido_origen_id; todos los extras cuelgan del original, no en cadena).
 * Solo es una vista: los filtros, contadores y resumen del día siguen contando CADA pedido por separado.
 */
export interface Cuenta<T> {
  raizId: string;
  /** Original primero (si está cargado) y luego los extras en orden de creación */
  miembros: T[];
  /** Ids de los miembros que cumplen el filtro activo; los demás se muestran atenuados */
  coincide: Set<string>;
}

const num = (id: string | number) => Number(id);

/**
 * Agrupa la lista ya filtrada y ordenada (`visibles`). Cada cuenta ocupa el lugar de su PRIMER miembro en esa lista, así que
 * con «más recientes primero» sube al llegar un extra y con «más antiguos primero» queda donde está el original.
 * `universo` trae todos los pedidos cargados (también los que el filtro oculta) para mostrar la cuenta completa.
 */
export function agruparCuentas<T extends { id: string | number }>(
  visibles: T[],
  universo: T[],
  raizDe: (t: T) => string,
): Cuenta<T>[] {
  const porRaiz = new Map<string, Map<string, T>>();
  for (const t of universo.concat(visibles)) {
    const r = raizDe(t);
    if (!porRaiz.has(r)) porRaiz.set(r, new Map());
    const m = porRaiz.get(r)!;
    if (!m.has(String(t.id))) m.set(String(t.id), t);
  }
  const coincidePorRaiz = new Map<string, Set<string>>();
  for (const t of visibles) {
    const r = raizDe(t);
    if (!coincidePorRaiz.has(r)) coincidePorRaiz.set(r, new Set());
    coincidePorRaiz.get(r)!.add(String(t.id));
  }
  const cuentas: Cuenta<T>[] = [];
  const vistas = new Set<string>();
  for (const t of visibles) {
    const r = raizDe(t);
    if (vistas.has(r)) continue;
    vistas.add(r);
    const miembros = [...porRaiz.get(r)!.values()].sort((a, b) => {
      const ra = String(a.id) === r ? 0 : 1;
      const rb = String(b.id) === r ? 0 : 1;
      return ra - rb || num(a.id) - num(b.id);
    });
    cuentas.push({ raizId: r, miembros, coincide: coincidePorRaiz.get(r)! });
  }
  return cuentas;
}

/** Un pedido vigente suma a la cuenta; anulado o rechazado no. */
export const suma = (estado: string) => !['ANULADO', 'RECHAZADO'].includes(String(estado || '').toUpperCase());
