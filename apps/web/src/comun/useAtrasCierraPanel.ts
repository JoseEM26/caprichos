import { useEffect, useRef } from 'react';

/** ¿Vista de una sola columna (celular)? Mismo corte que el CSS de Mensajes. */
export const esVistaMovil = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;

interface Opciones {
  /** Solo se toca el historial si es true (celular). En escritorio no hace nada. */
  activo: boolean;
  /** Parámetro que se escribe en la URL mientras el panel está abierto (la recarga lo reabre). */
  param?: [nombre: string, valor: string];
  /** Parámetros de entrada directa (p. ej. `telefono`) que se quitan de la entrada de la lista. */
  limpiar?: string[];
}

/**
 * «Atrás» del celular cierra el panel (chat, detalle) en vez de salir de la pantalla.
 * Abrir apila UNA entrada de historial; popstate cierra; cerrar con el botón ← deshace esa entrada.
 */
export function useAtrasCierraPanel(abierto: boolean, cerrar: () => void, { activo, param, limpiar }: Opciones) {
  const apilado = useRef(false);
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  useEffect(() => {
    const alAtras = () => {
      if (!apilado.current) return;
      apilado.current = false;
      cerrarRef.current();
    };
    window.addEventListener('popstate', alAtras);
    return () => window.removeEventListener('popstate', alAtras);
  }, []);

  const valor = param?.[1];
  useEffect(() => {
    if (!activo) return;
    if (abierto && !apilado.current) {
      apilado.current = true;
      // Tras una recarga la entrada del panel ya existe: no se apila otra
      if (window.history.state?.atrasPanel) return;
      const url = new URL(window.location.href);
      if (limpiar?.some((p) => url.searchParams.has(p))) {
        limpiar.forEach((p) => url.searchParams.delete(p));
        window.history.replaceState(window.history.state, '', url);
      }
      if (param) url.searchParams.set(param[0], param[1]);
      window.history.pushState({ atrasPanel: true }, '', url);
    } else if (!abierto && apilado.current) {
      apilado.current = false;
      if (window.history.state?.atrasPanel) window.history.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activo, valor]);
}
