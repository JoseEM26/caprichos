import { useEffect, useId, useRef, useState } from 'react';
import type { RolImpresora } from '@caprichos/compartido';
import { MaquinasImpresion, NOMBRE_MAQUINA, programaApagado } from './useEstadoMaquinas';
import { PanelInstalarPrograma } from './PanelInstalarPrograma';

/**
 * Dos chips compactos «Etiquetera» y «Ticketera» con un punto de color (verde conectada, rojo no).
 * Al pulsar uno se abre un desplegable con el motivo, Ver cola e Instalar programa.
 */
export function IndicadoresMaquinas({
  maquinas,
  alVerCola,
}: {
  maquinas: MaquinasImpresion | null;
  alVerCola?: () => void;
}) {
  const [abierto, setAbierto] = useState<RolImpresora | null>(null);
  const [instalar, setInstalar] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(null);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!maquinas) return null;

  return (
    <div ref={raiz} data-testid="indicadores-maquinas" style={{ position: 'relative', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {(['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).map((rol) => {
        const m = maquinas[rol];
        return (
          <button
            key={rol}
            type="button"
            data-testid={`indicador-${rol.toLowerCase()}`}
            aria-expanded={abierto === rol}
            aria-controls={abierto === rol ? idPanel : undefined}
            title={m.motivo ?? undefined}
            onClick={() => setAbierto((a) => (a === rol ? null : rol))}
            style={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              borderRadius: 9999,
              border: `1.5px solid ${abierto === rol ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-line, #E3D6C6)'}`,
              background: 'var(--cp-white, #FFFFFF)',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 9, height: 9, borderRadius: '50%', background: m.conectada ? '#2E7D32' : 'var(--cp-rust, #B2500F)' }}
            />
            {NOMBRE_MAQUINA[rol]}
          </button>
        );
      })}

      {abierto && (
        <div
          id={idPanel}
          role="region"
          aria-label={`Estado de ${NOMBRE_MAQUINA[abierto]}`}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 60,
            width: 'min(300px, calc(100vw - 32px))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 12,
            border: '1.5px solid var(--cp-line, #E3D6C6)',
            background: 'var(--cp-white, #FFFFFF)',
            boxShadow: '0 8px 24px rgba(11,44,62,0.15)',
            fontSize: 13,
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          <div>
            <strong>{NOMBRE_MAQUINA[abierto]}: {maquinas[abierto].conectada ? 'conectada' : 'no conectada'}</strong>
            {!maquinas[abierto].conectada && maquinas[abierto].motivo && <div style={{ color: 'var(--cp-soft, #2C4C5D)', marginTop: 2 }}>{maquinas[abierto].motivo}</div>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alVerCola && (
              <button type="button" className="cola-btn" onClick={() => { setAbierto(null); alVerCola(); }}>Ver cola</button>
            )}
            {programaApagado(maquinas) && (
              <button type="button" className="cola-btn" onClick={() => { setAbierto(null); setInstalar(true); }}>Instalar programa de impresión</button>
            )}
          </div>
        </div>
      )}

      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
    </div>
  );
}
