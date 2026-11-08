import { KeyboardEvent, ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import './ventana-detalle.css';

export interface VentanaDetalleProps {
  /** Nombre accesible de la ventana («Detalle del pedido CP-W004») */
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}

/**
 * Carcasa de una ventana grande sobre la pantalla: modal centrado en PC y hoja inferior (~95% de alto) en
 * tablet y celular. Fondo oscuro; cierra con la X, clic fuera o Escape. Foco atrapado y devuelto a quien la abrió.
 */
export function VentanaDetalle({ titulo, alCerrar, children }: VentanaDetalleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onTeclado = useDialogoAccesible(ref, alCerrar);
  // Un modal propio del detalle (cobrar, ubicar…) maneja su Escape y su Tab: la ventana no interviene
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const modal = e.target instanceof Element ? e.target.closest('[aria-modal="true"]') : null;
    if (modal && modal !== ref.current) return;
    onTeclado(e);
  };
  // Un arrastre que empieza dentro (seleccionar texto) y termina en el fondo no cierra la ventana
  const empezoEnFondo = useRef(true);

  // La pantalla de atrás no se desplaza mientras la ventana está abierta
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return createPortal(
    <div
      className="vd-fondo"
      onMouseDown={(e) => {
        empezoEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && empezoEnFondo.current) alCerrar();
        empezoEnFondo.current = true;
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="vd-ventana"
        onKeyDown={onKeyDown}
      >
        <div className="vd-asa" aria-hidden="true" />
        <button type="button" className="vd-cerrar" aria-label="Cerrar detalle del pedido" onClick={alCerrar}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="vd-cuerpo">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
