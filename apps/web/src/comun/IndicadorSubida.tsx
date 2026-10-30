import type { CSSProperties } from 'react';
import type { EstadoSubida } from './useSubidaArchivo';

export interface IndicadorSubidaProps {
  estado: EstadoSubida;
  error?: string | null;
  onReintentar?: () => void;
  /** Texto cuando el servidor ya guardó. */
  textoListo?: string;
  /** Texto mientras la imagen viaja al servidor. */
  textoSubiendo?: string;
}

const base: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 700,
  minHeight: '44px',
};

/** Estado visible de una subida: «Subiendo imagen…» con spinner, «listo» o error con Reintentar. */
export function IndicadorSubida({
  estado,
  error,
  onReintentar,
  textoListo = 'Foto guardada',
  textoSubiendo = 'Subiendo imagen…',
}: IndicadorSubidaProps) {
  if (estado === 'inactivo') return null;

  if (estado === 'subiendo') {
    return (
      <div role="status" aria-live="polite" style={{ ...base, color: 'var(--cp-navy)' }}>
        <span
          aria-hidden="true"
          style={{
            width: 18,
            height: 18,
            border: '3px solid var(--cp-line)',
            borderTopColor: 'var(--cp-orange)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'cp-spin 0.8s linear infinite',
          }}
        />
        {textoSubiendo}
      </div>
    );
  }

  if (estado === 'listo') {
    return (
      <div role="status" aria-live="polite" style={{ ...base, color: 'var(--cp-navy)' }}>
        {textoListo}
      </div>
    );
  }

  return (
    <div role="alert" style={{ ...base, color: 'var(--cp-rust)' }}>
      <span>{error || 'No se pudo subir la imagen. Inténtalo de nuevo.'}</span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          style={{
            minHeight: '44px',
            padding: '0 14px',
            borderRadius: '10px',
            border: '1.5px solid var(--cp-rust)',
            background: 'transparent',
            color: 'var(--cp-rust)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
