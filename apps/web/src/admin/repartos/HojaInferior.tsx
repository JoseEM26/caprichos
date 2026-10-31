import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';

/** Cuánto hay que arrastrar hacia abajo para que la hoja se cierre al soltar. */
const UMBRAL_CIERRE_PX = 80;

/**
 * Hoja inferior propia (sin librerías): sube desde abajo hasta la mitad del espacio, deja el mapa
 * visible y usable arriba, y se cierra con el asa hacia abajo, el botón Cerrar o Escape.
 * `desdeAbajo` es lo que ocupa la barra inferior fija, para que la hoja quede sobre ella.
 */
export function HojaInferior({
  titulo,
  desdeAbajo,
  alCerrar,
  children,
}: {
  titulo: string;
  desdeAbajo: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const [arrastre, setArrastre] = useState(0);
  const inicioY = useRef<number | null>(null);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [alCerrar]);

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    inicioY.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    if (inicioY.current == null) return;
    setArrastre(Math.max(0, e.clientY - inicioY.current));
  };
  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    if (inicioY.current == null) return;
    const movido = e.clientY - inicioY.current;
    inicioY.current = null;
    setArrastre(0);
    if (movido > UMBRAL_CIERRE_PX) alCerrar();
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={titulo}
      data-testid="hoja-inferior"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: desdeAbajo,
        height: '50%',
        zIndex: 900,
        background: 'var(--cp-white)',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -6px 24px rgba(11,44,62,.3)',
        display: 'flex',
        flexDirection: 'column',
        transform: `translateY(${arrastre}px)`,
        transition: arrastre ? 'none' : 'transform .2s ease',
        animation: 'cp-hoja-sube .22s ease-out',
      }}
    >
      <style>{'@keyframes cp-hoja-sube{from{transform:translateY(100%)}to{transform:translateY(0)}}'}</style>
      <div
        data-testid="hoja-asa"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px 6px 16px',
          touchAction: 'none',
          cursor: 'grab',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <span
          aria-hidden="true"
          style={{ position: 'absolute', top: 6, left: '50%', width: 44, height: 5, marginLeft: -22, borderRadius: 3, background: 'var(--cp-line2)' }}
        />
        <strong style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 16, color: 'var(--cp-navy)', marginTop: 10 }}>{titulo}</strong>
        <button
          type="button"
          onClick={alCerrar}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: '0 14px',
            marginTop: 6,
            borderRadius: 12,
            border: '1.5px solid var(--cp-line)',
            background: 'var(--cp-cream)',
            color: 'var(--cp-navy)',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px', overscrollBehavior: 'contain' }}>{children}</div>
    </section>
  );
}
