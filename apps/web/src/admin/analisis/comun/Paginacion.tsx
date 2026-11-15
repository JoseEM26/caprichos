import { useEffect, useId, useState, type ReactNode } from 'react';
import './analisis.css';

export const TAMANOS_PAGINA = [10, 25, 50] as const;

/**
 * Paginación de una lista en memoria. Vuelve a la página 1 cuando cambia `reinicio` (filtros, búsqueda, orden)
 * y se acomoda sola si la lista se acorta.
 */
export function usePaginacion<T>(items: readonly T[], reinicio: unknown = '', tamanoInicial = 10) {
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(tamanoInicial);
  useEffect(() => setPagina(1), [reinicio]);
  const paginas = Math.max(1, Math.ceil(items.length / tamano));
  const actual = Math.min(pagina, paginas);
  const desde = (actual - 1) * tamano;
  return {
    filas: items.slice(desde, desde + tamano),
    total: items.length,
    pagina: actual,
    paginas,
    tamano,
    desde: items.length ? desde + 1 : 0,
    hasta: Math.min(desde + tamano, items.length),
    irA: (p: number) => setPagina(Math.min(Math.max(1, p), paginas)),
    cambiarTamano: (t: number) => {
      setTamano(t);
      setPagina(1);
    },
  };
}

export type EstadoPaginacion = ReturnType<typeof usePaginacion>;

/** Controles «‹ Anterior · Página N de M · Siguiente ›» + contador + tamaño. No se muestra si todo cabe en 10. */
export function Paginador({ p }: { p: EstadoPaginacion }) {
  const id = useId();
  if (p.total <= TAMANOS_PAGINA[0]) return null;
  return (
    <nav className="an-pag" aria-label="Páginas">
      <span className="an-pag__cuenta" role="status">
        Mostrando {p.desde}–{p.hasta} de {p.total}
      </span>
      <div className="an-pag__ctl">
        <button type="button" className="an-chip" disabled={p.pagina <= 1} onClick={() => p.irA(p.pagina - 1)}>
          ‹ Anterior
        </button>
        <span className="an-pag__pagina">
          Página {p.pagina} de {p.paginas}
        </span>
        <button type="button" className="an-chip" disabled={p.pagina >= p.paginas} onClick={() => p.irA(p.pagina + 1)}>
          Siguiente ›
        </button>
      </div>
      <label className="an-pag__tam" htmlFor={id}>
        Filas
        <select id={id} className="an-campo" value={p.tamano} onChange={(e) => p.cambiarTamano(Number(e.target.value))}>
          {TAMANOS_PAGINA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

/** Pagina `items` y entrega la porción a `children`; el paginador queda debajo. */
export function ListaPaginada<T>({ items, reinicio, children }: { items: readonly T[]; reinicio?: unknown; children: (filas: T[]) => ReactNode }) {
  const p = usePaginacion(items, reinicio);
  return (
    <>
      {children(p.filas)}
      <Paginador p={p} />
    </>
  );
}
