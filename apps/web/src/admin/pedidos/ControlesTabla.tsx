import { useState } from 'react';
import { COLUMNAS_CAJA, COLUMNAS_POR_DEFECTO } from './columnasCaja';
import { MEDIOS_FILTRO } from './mediosFila';
import {
  ConmutadorVista,
  SelectorColumnas as SelectorColumnasComun,
  normalizarVista,
  useCerrarFuera,
  type VistaLista,
} from '../../comun/tabla/ControlesTabla';

// El conmutador, el selector de columnas y la vista viven en comun/tabla (los comparte el Cierre).
export type VistaCaja = VistaLista;
export { ConmutadorVista, normalizarVista };

/** Selector de columnas de Caja: las columnas de Caja sobre el selector común. */
export function SelectorColumnas({ columnas, alCambiar }: { columnas: string[]; alCambiar: (c: string[]) => void }) {
  return <SelectorColumnasComun todas={COLUMNAS_CAJA} columnas={columnas} porDefecto={COLUMNAS_POR_DEFECTO} alCambiar={alCambiar} />;
}

/** Filtro de varios medios de pago, con la misma apariencia que FiltroCombo. Vacío = todos. */
export function FiltroMedios({ medios, alCambiar }: { medios: string[]; alCambiar: (m: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useCerrarFuera(abierto, () => setAbierto(false));
  const resumen = medios.length === 0 ? 'Todos' : MEDIOS_FILTRO.filter((m) => medios.includes(m.id)).map((m) => m.n).join(', ');
  const filtrado = medios.length > 0;
  return (
    <div ref={raiz} style={{ position: 'relative', flex: '1 1 160px', minWidth: 160 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Medio de pago: ${resumen}`}
        onClick={() => setAbierto((a) => !a)}
        style={{
          width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 12px',
          borderRadius: 12, border: `1.5px solid ${filtrado ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
          background: filtrado ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)', color: 'var(--cp-navy, #0B2C3E)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '15px', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 700 }}>Medio de pago</span>
          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumen}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div
          role="listbox"
          aria-label="Medio de pago"
          aria-multiselectable="true"
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%', zIndex: 60, background: 'var(--cp-white, #FFFFFF)', border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 12, boxShadow: '0 8px 24px rgba(11,44,62,0.15)' }}
        >
          {MEDIOS_FILTRO.map((m) => {
            const activo = medios.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => alCambiar(activo ? medios.filter((x) => x !== m.id) : [...medios, m.id])}
                style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', border: 0, borderBottom: '1px solid var(--cp-line, #E3D6C6)', background: activo ? 'var(--cp-sand, #F1E6D6)' : 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 13, fontWeight: activo ? 800 : 600, textAlign: 'left', cursor: 'pointer' }}
              >
                <span aria-hidden="true">{activo ? '☑' : '☐'}</span>
                {m.n}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
