import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CLAVE = 'caprichos_editor_pantalla_completa';

interface Valor {
  completa: boolean;
  alternar: () => void;
}
const Contexto = createContext<Valor>({ completa: false, alternar: () => {} });
export const usePantallaCompleta = () => useContext(Contexto);

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

/**
 * Raíz de un editor en sitio. En pantalla completa sale por un portal a `body` (así ningún zoom ni
 * transform del admin la deforma), cubre menú y cabecera, y pide además la Fullscreen API del navegador.
 */
export function EditorPantalla({ children }: { children: ReactNode }) {
  const [completa, setCompleta] = useState<boolean>(leer);
  const conApi = useRef(false);

  const fijar = useCallback((v: boolean) => {
    setCompleta(v);
    try {
      localStorage.setItem(CLAVE, v ? '1' : '0');
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    if (typeof document === 'undefined') return;
    if (v) {
      // respaldo: si el navegador la niega, el overlay fijo basta
      try {
        Promise.resolve(document.documentElement.requestFullscreen?.()).then(() => { conApi.current = !!document.fullscreenElement; }).catch(() => {});
      } catch { /* sin API */ }
    } else if (document.fullscreenElement) {
      conApi.current = false;
      Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!completa) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fijar(false);
    };
    // el navegador sale solo con Esc cuando usó la Fullscreen API
    const cambio = () => {
      if (!document.fullscreenElement && conApi.current) {
        conApi.current = false;
        fijar(false);
      }
    };
    window.addEventListener('keydown', tecla);
    document.addEventListener('fullscreenchange', cambio);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.removeEventListener('fullscreenchange', cambio);
    };
  }, [completa, fijar]);

  // al salir de la pantalla del editor no se deja el navegador a pantalla completa
  useEffect(() => () => {
    if (typeof document !== 'undefined' && document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
  }, []);

  const cuerpo = (
    <div
      data-testid="editor-pantalla"
      data-completa={completa ? '1' : undefined}
      style={
        completa
          ? { position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--cp-cream)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
          : { display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }
      }
    >
      <style>{'[data-completa="1"] .ep-nota{display:none}'}</style>
      {children}
    </div>
  );

  return (
    <Contexto.Provider value={{ completa, alternar: () => fijar(!completa) }}>
      {completa && typeof document !== 'undefined' ? createPortal(cuerpo, document.body) : cuerpo}
    </Contexto.Provider>
  );
}
