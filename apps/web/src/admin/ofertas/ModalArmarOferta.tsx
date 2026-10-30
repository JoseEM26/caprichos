interface ModalArmarOfertaProps {
  abierto: boolean;
  onCerrar: () => void;
  onElegirCombo: () => void;
  onElegirPromo: () => void;
  onElegirDescuento: () => void;
}

export function ModalArmarOferta({
  abierto,
  onCerrar,
  onElegirCombo,
  onElegirPromo,
  onElegirDescuento,
}: ModalArmarOfertaProps) {
  if (!abierto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* Fondo clickeable */}
      <div
        onClick={onCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.55)',
          zIndex: 60,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Armar oferta"
        style={{
          position: 'absolute',
          zIndex: 65,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(970px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            ¿Qué oferta quieres armar?
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
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
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Todas se pueden limitar por días, horas, fechas y canal. Si no pones nada, valen siempre.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onElegirCombo}
            style={{
              textAlign: 'left',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '14px',
              backgroundColor: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
              Combo
            </span>
            <span style={{ fontSize: '13px', lineHeight: '18px' }}>
              Varios productos por un precio. El cliente elige dentro de cada parte.
            </span>
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Ejemplo: Dúo: 2 bebidas + 1 complemento por s/ 33
            </span>
          </button>

          <button
            type="button"
            onClick={onElegirPromo}
            style={{
              textAlign: 'left',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '14px',
              backgroundColor: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
              Llevas más, pagas menos
            </span>
            <span style={{ fontSize: '13px', lineHeight: '18px' }}>
              Un precio especial al llevar varias unidades del mismo producto.
            </span>
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Ejemplo: 2x1 en Latte, solo los martes
            </span>
          </button>

          <button
            type="button"
            onClick={onElegirDescuento}
            style={{
              textAlign: 'left',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '14px',
              backgroundColor: 'var(--cp-white)',
              color: 'var(--cp-navy)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
              Descuento
            </span>
            <span style={{ fontSize: '13px', lineHeight: '18px' }}>
              Un porcentaje o un monto menos en un producto, una categoría o toda la carta.
            </span>
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Ejemplo: 10 % en waffles los domingos
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
