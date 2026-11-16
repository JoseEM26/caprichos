import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Boton, type VarianteBoton } from '../../../comun/Boton';

export interface OpcionDialogo {
  texto: string;
  variante?: VarianteBoton;
  alElegir: () => void;
}

/** Ventana con 2 o 3 botones (Confirmar solo tiene Sí/No). Escape y clic afuera eligen la última opción (la más segura). */
export function DialogoOpciones({ titulo, mensaje, opciones }: { titulo: string; mensaje: string; opciones: OpcionDialogo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const segura = opciones[opciones.length - 1];
  const seguraRef = useRef(segura);
  seguraRef.current = segura;
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') seguraRef.current.alElegir();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, []);
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(11, 44, 62, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}
      onClick={segura.alElegir}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '440px', boxSizing: 'border-box', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <h2 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '18px', color: 'var(--cp-navy)' }}>{titulo}</h2>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: 'var(--cp-soft)' }}>{mensaje}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end' }}>
          {opciones.map((o) => (
            <Boton key={o.texto} variante={o.variante ?? 'secundario'} onClick={o.alElegir}>
              {o.texto}
            </Boton>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
