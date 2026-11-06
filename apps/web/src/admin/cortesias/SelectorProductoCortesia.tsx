import { useId, useMemo, useState } from 'react';
import type { ProductoAdmin } from '../catalogo/catalogoApi';

/** Agotado a mano, hasta una fecha futura, o con stock propio en 0 por sabores. */
export function productoAgotado(p: ProductoAdmin, ahora = Date.now()): boolean {
  if (!p.disponible) return true;
  return !!p.agotadoHasta && new Date(p.agotadoHasta).getTime() > ahora;
}

/** Suma de «quedan» de los sabores cuando el producto controla stock por sabor; null si no hay dato. */
export function quedanDeProducto(p: ProductoAdmin): number | null {
  if (!p.controlaStock) return null;
  const con = (p.sabores ?? []).filter((s) => s.activo !== false && typeof s.quedan === 'number');
  return con.length > 0 ? con.reduce((a, s) => a + (s.quedan as number), 0) : null;
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  productos: ProductoAdmin[];
  cargando: boolean;
  alElegir: (p: ProductoAdmin) => void;
}

/** Buscador + chips de categorías + resultados agrupados por categoría. */
export function SelectorProductoCortesia({ productos, cargando, alElegir }: Props) {
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const idLista = useId();

  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    productos.forEach((p) => m.set(p.categoriaId, p.categoria?.nombre ?? 'Otros'));
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [productos]);

  const grupos = useMemo(() => {
    const t = sinTildes(q.trim());
    const filtrados = productos.filter((p) => (!categoria || p.categoriaId === categoria) && (!t || sinTildes(p.nombre).includes(t)));
    return categorias
      .map((c) => ({ ...c, items: filtrados.filter((p) => p.categoriaId === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [productos, categorias, categoria, q]);

  return (
    <div className="cpx-selector">
      <input
        type="search"
        className="cpx-input"
        aria-label="Buscar producto"
        placeholder={cargando ? 'Cargando carta…' : 'Escribe para buscar un producto'}
        value={q}
        disabled={cargando}
        onChange={(e) => setQ(e.target.value)}
        aria-controls={idLista}
      />
      <div className="cpx-chips" role="group" aria-label="Categorías">
        <button type="button" className="cpx-chip" aria-pressed={categoria === ''} onClick={() => setCategoria('')}>
          Todas
        </button>
        {categorias.map((c) => (
          <button key={c.id} type="button" className="cpx-chip" aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)}>
            {c.nombre}
          </button>
        ))}
      </div>
      <div id={idLista} className="cpx-lista" role="listbox" aria-label="Productos">
        {grupos.length === 0 && !cargando && <p className="cpx-vacio">No hay productos con ese nombre.</p>}
        {grupos.map((g) => (
          <div key={g.id} role="group" aria-label={g.nombre}>
            <div className="cpx-grupo">{g.nombre}</div>
            {g.items.map((p) => {
              const agotado = productoAgotado(p);
              const quedan = quedanDeProducto(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="cpx-fila"
                  disabled={agotado}
                  onClick={() => alElegir(p)}
                >
                  <span>{p.nombre}</span>
                  {agotado ? <b className="cpx-agotado">Agotado</b> : quedan !== null ? <small>Quedan {quedan}</small> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
