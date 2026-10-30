import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DispositivoForzado } from '../carta/useEsMovil';
import { usePantallaCompleta } from './PantallaCompleta';
import './marco-dispositivo.css';

// ancho exterior (con borde). La PC es fluida: ocupa el espacio y solo se reduce bajo 700 px (el corte real de la carta).
const ANCHO = { celular: 390 + 16, pc: 700 };

/** Conmutador Celular / Computadora (toques de 44 px). */
export function ConmutadorDispositivo({ celular, onCambiar }: { celular: boolean; onCambiar: (celular: boolean) => void }) {
  return (
    <div className="mdv-conmutador" role="group" aria-label="Dispositivo">
      <button type="button" className="mdv-btn" aria-pressed={celular} data-testid="btn-disp-celular" onClick={() => onCambiar(true)}>Celular</button>
      <button type="button" className="mdv-btn" aria-pressed={!celular} data-testid="btn-disp-pc" onClick={() => onCambiar(false)}>Computadora</button>
    </div>
  );
}

/**
 * Marco de dispositivo simulado. Mide 390 px (celular) o 1000 px (PC) y, si el espacio disponible es menor,
 * se reduce con `zoom` para que quepa entero. Contiene la ventana de producto de la carta (position: fixed)
 * dentro del marco y fuerza el dispositivo para los ganchos de la carta.
 */
export function MarcoDispositivo({ celular, children, etiqueta = 'Vista previa de la carta', fiel }: { celular: boolean; children: ReactNode; etiqueta?: string; fiel?: boolean }) {
  const pista = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const { completa } = usePantallaCompleta();
  const total = celular ? ANCHO.celular : ANCHO.pc;

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => setEscala(!completa && el.clientWidth > 0 ? Math.min(1, el.clientWidth / total) : 1);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [total, completa]);

  return (
    <div ref={pista} className={`mdv-pista${completa ? ' mdv-pista--completa' : ''}`} data-testid="mdv-pista">
      <div
        className={`mdv-marco${celular ? ' mdv-marco--celular' : ''}${completa ? ' mdv-marco--completa' : ''}${fiel ? ' mdv-marco--fiel' : ''}`}
        data-testid={`preview-container-${celular ? 'celular' : 'pc'}`}
        data-dispositivo={celular ? 'celular' : 'pc'}
        data-escala={escala.toFixed(3)}
        data-completa={completa ? '1' : undefined}
        role="region"
        aria-label={etiqueta}
        style={!completa && escala < 1 ? ({ zoom: escala } as React.CSSProperties) : undefined}
      >
        <div className="mdv-contenido">
          <DispositivoForzado movil={celular}>{children}</DispositivoForzado>
        </div>
      </div>
    </div>
  );
}
