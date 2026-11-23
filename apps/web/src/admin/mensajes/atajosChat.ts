import { useEffect, useRef } from 'react';

/** ¿El foco está en un campo de escritura que NO es el cuadro del chat? Ahí los atajos no estorban. */
export function enOtroCampo(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  if (e.hasAttribute?.('data-cuadro-chat')) return false;
  return e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable;
}

export interface AtajosChatOpciones {
  /** Ids de los chats en el orden de la lista. */
  ids: string[];
  actual: string | null;
  seleccionar: (id: string) => void;
  /** Esc: cierra el panel o el chat; devuelve true si había algo que cerrar. */
  cerrar: () => boolean;
  /** «?» (fuera de un campo) o Alt+/ abre la ayuda. */
  alternarAyuda?: () => void;
}

/**
 * Alt+↑ / Alt+↓ cambian de chat; Esc cierra el panel o el chat. Funcionan también con el foco en el cuadro de escribir,
 * pero no cuando se escribe en otro campo (búsqueda, modales). Enter/Shift+Enter y Esc del menú «/» los resuelve el cuadro de escribir.
 */
export function useAtajosChat(o: AtajosChatOpciones): void {
  const ref = useRef(o);
  ref.current = o;
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const { ids, actual, seleccionar, cerrar } = ref.current;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (enOtroCampo(e.target) || ids.length === 0) return;
        const i = actual ? ids.indexOf(actual) : -1;
        const sig = e.key === 'ArrowDown' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
        e.preventDefault();
        if (ids[sig] !== actual) seleccionar(ids[sig]);
        return;
      }
      if (e.key === 'Escape') {
        // con texto escrito en el cuadro, Esc no cierra el chat (se perdería el borrador de vista)
        if (enOtroCampo(e.target) || (e.target as HTMLTextAreaElement)?.value || document.querySelector('[role="dialog"]')) return;
        if (cerrar()) e.preventDefault();
        return;
      }
      const enCampo = (e.target as HTMLElement | null)?.tagName;
      const escribiendo = enCampo === 'INPUT' || enCampo === 'TEXTAREA' || enCampo === 'SELECT';
      if ((e.altKey && e.key === '/') || (e.key === '?' && !escribiendo)) {
        e.preventDefault();
        ref.current.alternarAyuda?.();
      }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, []);
}
