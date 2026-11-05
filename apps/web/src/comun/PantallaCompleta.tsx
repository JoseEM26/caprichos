import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

/** Esc cierra la pantalla completa solo si no hay nada que cerrar antes: campo editable, diálogo, menú o popover. */
export function escParaSalir(e: KeyboardEvent): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented) return false;
  const activo = document.activeElement as HTMLElement | null;
  if (activo && activo.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return false;
  if (activo?.isContentEditable) return false;
  if (document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[aria-modal="true"]')) return false;
  return true;
}

/**
 * Raíz de un editor en sitio. En pantalla completa sale por un portal a `body` (así ningún zoom ni
 * transform del admin la deforma) y cubre menú y cabecera. Esa capa fija es la pantalla completa:
 * que el navegador salga de su Fullscreen API (Esc, diálogo nativo, cambio de pestaña) no la cierra;
 * solo la cierra el botón o Esc con nada más abierto. Al desmontarse por navegar a otra pantalla
 * (otra dirección) se suelta también la Fullscreen API; un remonte en la misma pantalla (recarga) no.
 */
export function EditorPantalla({ children }: { children: ReactNode }) {
  const [completa, setCompleta] = useState<boolean>(leer);

  const pedirApi = useCallback(() => {
    try {
      Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => {});
    } catch {
      /* sin API: el overlay basta */
    }
  }, []);

  const fijar = useCallback((v: boolean) => {
    setCompleta(v);
    try {
      localStorage.setItem(CLAVE, v ? '1' : '0');
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    if (typeof document === 'undefined') return;
    if (v) pedirApi();
    else if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
  }, [pedirApi]);

  useEffect(() => {
    if (!completa) return;
    const tecla = (e: KeyboardEvent) => {
      if (escParaSalir(e)) fijar(false);
    };
    // el navegador salió de su API: no se cierra el overlay; se pide la API otra vez en el próximo toque
    let reintento: (() => void) | null = null;
    const alSalirApi = () => {
      if (document.fullscreenElement || reintento) return;
      reintento = () => {
        reintento = null;
        pedirApi();
      };
      document.addEventListener('pointerdown', reintento, { once: true });
    };
    window.addEventListener('keydown', tecla);
    document.addEventListener('fullscreenchange', alSalirApi);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.removeEventListener('fullscreenchange', alSalirApi);
      if (reintento) document.removeEventListener('pointerdown', reintento);
    };
  }, [completa, fijar, pedirApi]);

  // Solo al navegar a otra pantalla. Un remonte del mismo editor (recarga tras publicar) deja la API como está.
  useEffect(() => {
    const destino = window.location.href;
    return () => {
      if (window.location.href === destino) return;
      if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    };
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
