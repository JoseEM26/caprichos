import { createContext, useContext, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { ProveedorEdicion } from '../../../carta/edicion';
import type { ModoEdicion } from '../../../carta/edicion';
import { ESTILOS_EDICION } from './estilos';

interface Seleccion {
  sel: string | null;
  setSel: (clave: string | null) => void;
  /** Clave del bloque que se está arrastrando. */
  arrastre: MutableRefObject<string | null>;
}
const ContextoSeleccion = createContext<Seleccion | null>(null);
export const useSeleccionEd = () => useContext(ContextoSeleccion);

const PERMITIDOS = '[data-edicion="barra"],[data-edicion="texto"],[data-edicion="pop"],[data-edicion="fantasma"]';

/**
 * Envuelve la carta real en modo edición. Un toque sobre cualquier cosa de la carta selecciona su bloque
 * (aparece su barra) y no ejecuta nada de la carta: no navega, no pide, no abre ventanas.
 */
export function LienzoEdicion({ ed, sel, setSel, children }: { ed: ModoEdicion; sel: string | null; setSel: (clave: string | null) => void; children: ReactNode }) {
  const arrastre = useRef<string | null>(null);
  return (
    <ContextoSeleccion.Provider value={{ sel, setSel, arrastre }}>
      <ProveedorEdicion value={ed}>
        <div
          data-testid="lienzo-edicion"
          onClickCapture={(e) => {
            const t = e.target as HTMLElement;
            // un clic en algo editable (foto del banner, datos del local) selecciona su bloque y sigue su camino
            if (t.closest('[data-edicion="accion"]')) {
              setSel(t.closest<HTMLElement>('.ed-bloque')?.dataset.clave ?? null);
              return;
            }
            if (t.closest(PERMITIDOS)) return;
            e.preventDefault();
            e.stopPropagation();
            setSel(t.closest<HTMLElement>('.ed-bloque')?.dataset.clave ?? null);
          }}
        >
          <style>{ESTILOS_EDICION}</style>
          {children}
        </div>
      </ProveedorEdicion>
    </ContextoSeleccion.Provider>
  );
}

/** Tarjeta fantasma «+ Agregar» en el mismo lugar donde aparecerá lo nuevo. */
export function Fantasma({ etiqueta, onClick, estilo }: { etiqueta: string; onClick: () => void; estilo?: React.CSSProperties }) {
  return (
    <button type="button" data-edicion="fantasma" className="ed-fantasma" style={estilo} onClick={onClick}>
      + {etiqueta}
    </button>
  );
}
