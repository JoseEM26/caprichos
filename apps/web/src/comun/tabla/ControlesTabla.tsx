import { useEffect, useRef, useState } from 'react';
import './tabla-comun.css';

/**
 * Controles comunes de las listas con «Tarjetas | Tabla» (Caja y Cierre): conmutador de vista, selector de columnas
 * y filtro de varias opciones. Los usa cada pantalla con sus propias columnas y opciones.
 */

export type VistaLista = 'tarjetas' | 'tabla';
export const normalizarVista = (v: unknown): VistaLista => (v === 'tabla' ? 'tabla' : 'tarjetas');

/** Columna que ofrece una tabla: lo mínimo que necesita el selector. */
export interface ColumnaElegible {
  id: string;
  titulo: string;
}

/** Lista guardada → ids válidos de `todas`, sin repetir y en su orden; si queda vacía vuelve a `porDefecto`. */
export function normalizarColumnasDe(v: unknown, todas: ColumnaElegible[], porDefecto: string[]): string[] {
  if (!Array.isArray(v)) return porDefecto;
  const ids = todas.map((c) => c.id);
  const ok = [...new Set(v.filter((x): x is string => typeof x === 'string' && ids.includes(x)))];
  return ok.length ? ok : porDefecto;
}

/** Orden completo para el selector: primero las visibles (en su orden), luego las ocultas. */
export function ordenSelectorDe(visibles: string[], todas: ColumnaElegible[]): string[] {
  return [...visibles, ...todas.map((c) => c.id).filter((i) => !visibles.includes(i))];
}

const ROTULO_VISTA = { tarjetas: 'Tarjetas', tabla: 'Tabla', lista: 'Lista' } as const;

/** Conmutador «Tarjetas | Tabla» (Caja le agrega «Lista» con `opciones`). */
export function ConmutadorVista<V extends keyof typeof ROTULO_VISTA = VistaLista>({
  vista,
  alCambiar,
  opciones = ['tarjetas', 'tabla'] as unknown as V[],
}: {
  vista: V;
  alCambiar: (v: V) => void;
  opciones?: readonly V[];
}) {
  return (
    <div className="cj2-vista" role="group" aria-label="Vista de la lista">
      {opciones.map((v) => (
        <button key={v} type="button" className="cj2-vista-op" aria-pressed={vista === v} onClick={() => alCambiar(v)}>
          {ROTULO_VISTA[v]}
        </button>
      ))}
    </div>
  );
}

/** Cierra un menú con clic fuera o Escape. */
export function useCerrarFuera(abierto: boolean, cerrar: () => void) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);
  return raiz;
}

/** Botón «Columnas»: casillas para mostrar u ocultar y flechas para el orden. Siempre queda al menos una. */
export function SelectorColumnas({
  todas,
  columnas,
  porDefecto,
  alCambiar,
}: {
  todas: ColumnaElegible[];
  columnas: string[];
  porDefecto: string[];
  alCambiar: (c: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  const lista = ordenSelectorDe(columnas, todas);
  const titulo = (id: string) => todas.find((c) => c.id === id)!.titulo;
  const alternar = (id: string) => {
    if (columnas.includes(id)) {
      if (columnas.length > 1) alCambiar(columnas.filter((x) => x !== id));
    } else {
      alCambiar([...columnas, id]);
    }
  };
  const mover = (id: string, d: -1 | 1) => {
    const i = columnas.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= columnas.length) return;
    const n = [...columnas];
    [n[i], n[j]] = [n[j], n[i]];
    alCambiar(n);
  };
  return (
    <div className="cj2-menu-rel" ref={raiz}>
      <button type="button" className="cj2-btn" aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto((a) => !a)}>
        Columnas
      </button>
      {abierto && (
        <div className="cj2-col-panel" role="group" aria-label="Columnas de la tabla">
          {lista.map((id) => {
            const visible = columnas.includes(id);
            return (
              <div key={id} className="cj2-col-fila">
                <label>
                  <input type="checkbox" checked={visible} onChange={() => alternar(id)} />
                  <span>{titulo(id)}</span>
                </label>
                {visible && (
                  <span className="cj2-col-mover">
                    <button type="button" aria-label={`Subir ${titulo(id)}`} disabled={columnas[0] === id} onClick={() => mover(id, -1)}>↑</button>
                    <button type="button" aria-label={`Bajar ${titulo(id)}`} disabled={columnas[columnas.length - 1] === id} onClick={() => mover(id, 1)}>↓</button>
                  </span>
                )}
              </div>
            );
          })}
          <button type="button" className="cj2-limpiar" onClick={() => alCambiar(porDefecto)}>Restablecer columnas</button>
        </div>
      )}
    </div>
  );
}

export interface OpcionFiltro {
  id: string;
  n: string;
}

/** Filtro de varias opciones con la apariencia de FiltroCombo. Vacío = todas. */
export function FiltroMultiple({
  titulo,
  opciones,
  elegidas,
  alCambiar,
}: {
  titulo: string;
  opciones: OpcionFiltro[];
  elegidas: string[];
  alCambiar: (e: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  const resumen = elegidas.length === 0 ? 'Todos' : opciones.filter((o) => elegidas.includes(o.id)).map((o) => o.n).join(', ') || 'Todos';
  const filtrado = elegidas.length > 0;
  return (
    <div ref={raiz} className="ctc-filtro">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${titulo}: ${resumen}`}
        className="ctc-filtro-btn"
        data-activo={filtrado}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="ctc-filtro-txt">
          <span className="ctc-filtro-tit">{titulo}</span>
          <span className="ctc-filtro-val">{resumen}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div role="listbox" aria-label={titulo} aria-multiselectable="true" className="ctc-filtro-lista">
          {opciones.length === 0 && <div className="ctc-filtro-vacio">Sin opciones</div>}
          {opciones.map((o) => {
            const activo = elegidas.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={activo}
                className="ctc-filtro-op"
                data-activo={activo}
                onClick={() => alCambiar(activo ? elegidas.filter((x) => x !== o.id) : [...elegidas, o.id])}
              >
                <span aria-hidden="true">{activo ? '☑' : '☐'}</span>
                {o.n}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
