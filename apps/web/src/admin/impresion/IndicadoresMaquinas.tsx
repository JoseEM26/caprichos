import { useState } from 'react';
import type { RolImpresora } from '@caprichos/compartido';
import { MaquinasImpresion, NOMBRE_MAQUINA, programaApagado } from './useEstadoMaquinas';
import { PanelInstalarPrograma } from './PanelInstalarPrograma';

/** Dos indicadores: «Etiquetera: conectada / no conectada», «Ticketera: …», con el motivo. */
export function IndicadoresMaquinas({
  maquinas,
  alVerCola,
}: {
  maquinas: MaquinasImpresion | null;
  alVerCola?: () => void;
}) {
  const [instalar, setInstalar] = useState(false);
  if (!maquinas) return null;
  return (
    <div
      data-testid="indicadores-maquinas"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 13 }}
    >
      {(['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).map((rol) => {
        const m = maquinas[rol];
        return (
          <span
            key={rol}
            data-testid={`indicador-${rol.toLowerCase()}`}
            title={m.motivo ?? undefined}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              fontWeight: 700,
              background: m.conectada ? '#E3F4E8' : '#FBE9DF',
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            {NOMBRE_MAQUINA[rol]}: {m.conectada ? 'conectada' : 'no conectada'}
            {!m.conectada && m.motivo ? ` (${m.motivo})` : ''}
          </span>
        );
      })}
      {alVerCola && (
        <button type="button" className="cola-btn" onClick={alVerCola}>Ver cola</button>
      )}
      {programaApagado(maquinas) && (
        <button type="button" className="cola-btn" onClick={() => setInstalar(true)}>Instalar programa de impresión</button>
      )}
      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
    </div>
  );
}
