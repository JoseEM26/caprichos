import type { ComboParteItem, OpcionDetalleCombo } from './ofertasApi';
import { productosDeLaParte, tipoDe, idsProductos, type CategoriaEditor, type ProductoEditor } from './partesComboModelo';

/** Misma regla del servidor (`esBebidaPorNombres`) con solo el nombre de la categoría: el editor no conoce el área. */
const esCategoriaBebida = (categoria?: string): boolean => /FRAPPE|ICED|FROZEN|CALIENTE|BEBIDA/.test((categoria ?? '').toUpperCase());

/**
 * Las partes del combo con la misma forma que la carta recibe del servidor (`id`, `opcionesDetalle`, `bebidas`,
 * `principalNombre`), armadas con lo que el editor tiene a mano. Así la vista previa abre el mismo asistente «Arma tu combo».
 * Las partes que ya traen `opcionesDetalle` (vienen del servidor) se dejan igual. No calcula stock: todo sale disponible.
 */
export function partesParaVistaPrevia(partes: ComboParteItem[], productos: ProductoEditor[], categorias: CategoriaEditor[]): ComboParteItem[] {
  return partes.map((p, i) => {
    const base: ComboParteItem = { ...p, id: String(p.id ?? (p as { uid?: string }).uid ?? `parte-${i}`) };
    if (tipoDe(p) === 'FIJO') {
      const principal = productos.find((x) => x.id === idsProductos(p)[0]);
      return principal && !base.principalNombre ? { ...base, principalNombre: principal.nombre } : base;
    }
    if (tipoDe(p) !== 'A_ELECCION' || (p.opcionesDetalle ?? []).length > 0) return base;
    // Las categorías pueden venir como id o como nombre
    const cats = categorias.filter((c) => (p.categorias ?? []).some((x) => String(x) === c.id || String(x).toLowerCase() === c.nombre.toLowerCase()));
    const elegibles = productosDeLaParte({ ...p, categorias: cats.map((c) => c.id) }, productos, categorias);
    if (elegibles.length === 0) return base;
    const opcionesDetalle: OpcionDetalleCombo[] = elegibles.map((x) => ({
      id: x.id,
      nombre: x.nombre,
      disponible: true,
      ...(x.fotoUrl ? { fotoUrl: x.fotoUrl } : {}),
      ...(x.categoria ? { categoria: x.categoria } : {}),
      ...(p.cuposProducto?.[x.id] && p.cuposProducto[x.id] > 1 ? { cupos: p.cuposProducto[x.id] } : {}),
    }));
    const bebidas = !p.paqueteGrupo && elegibles.every((x) => esCategoriaBebida(x.categoria));
    return { ...base, opcionesDetalle, ...(bebidas ? { bebidas: true } : {}) };
  });
}
