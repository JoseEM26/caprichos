import { useEffect } from 'react';
import { FotoIniciativa } from './FotoIniciativa';

export interface VisorCapturaModalProps {
  abierto: boolean;
  fotoUrl: string | null;
  titulo?: string;
  codigo?: string;
  alCerrar: () => void;
}

export function VisorCapturaModal({
  abierto,
  fotoUrl,
  titulo,
  codigo,
  alCerrar,
}: VisorCapturaModalProps) {
  useEffect(() => {
    if (!abierto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        alCerrar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, alCerrar]);

  if (!abierto || !fotoUrl) {
    return null;
  }

  return (
    <>
      {/* Fondo oscuro traslúcido */}
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(11, 44, 62, 0.75)',
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />

      {/* Contenedor del visor modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visor de captura"
        style={{
          position: 'fixed',
          zIndex: 90,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(920px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(11, 44, 62, 0.45)',
          border: '1.5px solid var(--cp-navy)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxSizing: 'border-box',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                lineHeight: '26px',
                color: 'var(--cp-navy)',
                overflowWrap: 'anywhere',
              }}
            >
              Captura adjunta {codigo ? `· ${codigo}` : ''}
            </div>
            {titulo && (
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                  overflowWrap: 'anywhere',
                }}
              >
                {titulo}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar visor"
            style={{
              flex: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '22px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Imagen en tamaño completo */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: '200px',
            maxHeight: 'calc(80vh - 120px)',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--cp-sand)',
            borderRadius: '14px',
            border: '1px solid var(--cp-line)',
            padding: '12px',
          }}
        >
          <FotoIniciativa
            src={fotoUrl}
            alt={titulo ? `Captura: ${titulo}` : 'Captura de iniciativa'}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(80vh - 150px)',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 4px 14px rgba(11, 44, 62, 0.15)',
            }}
          />
        </div>

        {/* Pie con botón Cerrar explícito */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            style={{
              minHeight: '44px',
              padding: '0 24px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
