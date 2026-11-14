import { useState } from 'react';
import type { ReactNode } from 'react';

/** Título corto de un bloque del paso de pago; `ayuda` (opcional) abre una nota plegable con el «?». */
export function TituloBloque({ id, children, ayuda }: { id: string; children: ReactNode; ayuda?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h3 id={id} style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
          {children}
        </h3>
        {ayuda && (
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={`${id}-ayuda`}
            aria-label={`Ayuda: ${typeof children === 'string' ? children : 'este bloque'}`}
            onClick={() => setAbierta((v) => !v)}
            style={{ width: 44, height: 44, margin: '-12px 0', background: 'none', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
          >
            <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 10, border: '1.5px solid var(--cp-navy)', color: 'var(--cp-navy)', fontSize: 11, fontWeight: 800, lineHeight: '17px', textAlign: 'center' }}>?</span>
          </button>
        )}
      </div>
      {ayuda && abierta && (
        <div id={`${id}-ayuda`} role="note" style={{ marginTop: '6px', fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)', background: 'var(--cp-sand)', borderRadius: '8px', padding: '8px 10px' }}>
          {ayuda}
        </div>
      )}
    </div>
  );
}
