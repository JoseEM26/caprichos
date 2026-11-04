export interface EstadoRechazoCambio {
  abierto: boolean;
  motivo: string;
  enviando: boolean;
  error: string | null;
}

export interface ModalRechazoCambioProps {
  estado: EstadoRechazoCambio;
  onCambiarMotivo: (motivo: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/** Diálogo para rechazar una solicitud de cambio de pedido, con el motivo que recibe el cliente. */
export function ModalRechazoCambio({ estado, onCambiarMotivo, onCancelar, onConfirmar }: ModalRechazoCambioProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--cp-navy, #0B2C3E)' }}>
          ¿Rechazar solicitud de cambio?
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
          Ingresa el motivo del rechazo. Este motivo se enviará al cliente por WhatsApp con honestidad y empatía.
        </p>
        <textarea
          rows={3}
          value={estado.motivo}
          onChange={(e) => onCambiarMotivo(e.target.value)}
          placeholder="Ej. El pedido ya está empacado y en la puerta para salir..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '14px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
        {estado.error && (
          <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '6px' }}>{estado.error}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              background: 'transparent',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#475569',
            }}
          >
            No, cancelar
          </button>
          <button
            type="button"
            disabled={!estado.motivo.trim() || estado.enviando}
            onClick={onConfirmar}
            style={{
              background: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: estado.motivo.trim() && !estado.enviando ? 'pointer' : 'not-allowed',
              opacity: estado.motivo.trim() && !estado.enviando ? 1 : 0.6,
            }}
          >
            {estado.enviando ? 'Rechazando...' : 'Sí, rechazar cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}
