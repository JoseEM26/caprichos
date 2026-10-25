import { useEffect, useRef } from 'react';
import { OfertaItem } from './ofertasApi';
import { PrevisualizacionCarta } from './PrevisualizacionCarta';

interface ModalPrevisualizacionCartaProps {
  abierto: boolean;
  oferta: OfertaItem | null;
  onCerrar: () => void;
  productosDisponibles?: Array<{
    id: string;
    nombre: string;
    categoriaId?: string;
    categoria?: string;
    precio?: number;
    noSumaBeneficios?: boolean;
    grupos?: any[];
  }>;
  categoriasDisponibles?: Array<{
    id: string;
    nombre: string;
    productos?: any[];
  }>;
}

export function ModalPrevisualizacionCarta({
  abierto,
  oferta,
  onCerrar,
  productosDisponibles = [],
  categoriasDisponibles = [],
}: ModalPrevisualizacionCartaProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const btnCerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;

    // Foco accesible al abrir
    const timer = setTimeout(() => {
      btnCerrarRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [abierto, onCerrar]);

  if (!abierto || !oferta) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Fondo oscuro clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.6)',
          zIndex: 60,
        }}
        aria-hidden="true"
      />

      {/* Contenedor del modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Vista previa en la carta: ${oferta.nombre}`}
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 65,
          width: 'min(920px, calc(100% - 24px))',
          maxHeight: 'min(860px, calc(100% - 24px))',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        {/* Cabecera del modal */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '1.5px solid var(--cp-line)',
            paddingBottom: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '20px',
                lineHeight: '26px',
                color: 'var(--cp-navy)',
              }}
            >
              Cómo se ve en la carta
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              {oferta.nombre} · Vista previa de solo lectura
            </div>
          </div>
          <button
            ref={btnCerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar vista previa"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
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

        {/* Previsualización interactiva reutilizable */}
        <PrevisualizacionCarta
          oferta={oferta}
          productosDisponibles={productosDisponibles}
          categoriasDisponibles={categoriasDisponibles}
          vistaInicial="tarjeta"
          dispositivoInicial="pc"
        />

        {/* Pie con botón cerrar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '8px',
            borderTop: '1px solid var(--cp-line)',
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            style={{
              minHeight: '44px',
              padding: '0 24px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
