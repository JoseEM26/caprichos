import type { CategoriaAdmin, ProductoAdmin } from './catalogoApi';

/**
 * Los combos viven en Ofertas › Combos: su producto anfitrión y la categoría interna «Combos» no se editan en Productos.
 * No se borra nada; solo se dejan fuera del listado y de los filtros.
 */
export function ocultarCombos(productos: ProductoAdmin[], categorias: CategoriaAdmin[]) {
  const anfitriones = productos.filter((p) => p.esAnfitrionCombo === true);
  const idsCategoriasCombo = new Set(
    categorias
      .filter((c) => {
        // Solo se oculta una categoría cuando TODOS sus productos son anfitriones de un combo real:
        // un producto común (p. ej. un «Dúo» que aún no es combo de Ofertas) debe seguir visible para poder editarlo.
        const suyos = productos.filter((p) => p.categoriaId === c.id);
        return suyos.length > 0 && suyos.every((p) => p.esAnfitrionCombo === true);
      })
      .map((c) => c.id),
  );
  return {
    productos: productos.filter((p) => p.esAnfitrionCombo !== true && !idsCategoriasCombo.has(p.categoriaId)),
    categorias: categorias.filter((c) => !idsCategoriasCombo.has(c.id)),
    combosOcultos: anfitriones.length,
  };
}
