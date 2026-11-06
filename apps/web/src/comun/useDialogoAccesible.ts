import { KeyboardEvent, RefObject, useEffect } from 'react';

const FOCALIZABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accesibilidad común de los modales: foco inicial dentro, foco atrapado con Tab, Esc cierra y el foco
 * vuelve a quien abrió el modal. Devuelve el `onKeyDown` que se pone en el elemento role="dialog".
 * El foco inicial va al elemento con `data-foco-inicial`, o al primero focalizable.
 */
export function useDialogoAccesible(
  ref: RefObject<HTMLElement | null>,
  alCerrar: () => void,
  bloquearCierre = false,
) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const inicial = el?.querySelector<HTMLElement>('[data-foco-inicial]') ?? el?.querySelector<HTMLElement>(FOCALIZABLE);
    (inicial ?? el)?.focus();
    return () => previo?.focus?.();
  }, [ref]);

  return (e: KeyboardEvent<HTMLElement>) => {
    const el = ref.current;
    // Los eventos de portales hijos (p. ej. Confirmar) burbujean por React: se ignoran.
    if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
    if (e.key === 'Escape') {
      if (!bloquearCierre) {
        e.stopPropagation();
        alCerrar();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const lista = Array.from(el.querySelectorAll<HTMLElement>(FOCALIZABLE)).filter((x) => !x.closest('[hidden]'));
    if (lista.length === 0) return e.preventDefault();
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === el)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && activo === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };
}
