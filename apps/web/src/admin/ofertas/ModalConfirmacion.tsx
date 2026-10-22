interface ModalConfirmacionProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmacion({
  abierto,
  titulo,
  mensaje,
  onConfirmar,
  onCancelar,
}: ModalConfirmacionProps) {
  if (!abierto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
      {/* Fondo clickeable para cerrar */}
      <div
        onClick={onCancelar}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(11, 44, 62, 0.6)',
          zIndex: 90,
        }}
      />
      {/* Diálogo */}
      <div
        role="alertdialog"
        aria-label="Confirmar acción"
        style={{
          position: 'absolute',
          zIndex: 95,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100% - 24px))',
          backgroundColor: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.45)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '20px',
            lineHeight: '26px',
            color: 'var(--cp-navy)',
          }}
        >
          {titulo}
        </div>
        <div style={{ fontSize: '14px', lineHeight: '20px', color: 'var(--cp-soft)' }}>
          {mensaje}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onConfirmar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: 0,
              borderRadius: '12px',
              backgroundColor: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Sí
          </button>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
