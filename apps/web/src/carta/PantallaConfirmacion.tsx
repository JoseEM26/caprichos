import { useCarrito } from './CarritoContext';
import { Icono } from '../comun/Icono';

export function PantallaConfirmacion() {
  const { pedidoConfirmado, setPedidoConfirmado } = useCarrito();

  if (!pedidoConfirmado) return null;

  const pasos = [
    { n: 'Pedido recibido', activo: true, completo: true },
    { n: 'En preparación en cocina', activo: true, completo: false },
    {
      n: pedidoConfirmado.modalidad === 'DELIVERY' ? 'En camino' : 'Listo para recoger',
      activo: false,
      completo: false,
    },
    { n: 'Entregado', activo: false, completo: false },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmación del pedido"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        backgroundColor: 'rgba(11, 44, 62, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(500px, 100%)',
          backgroundColor: 'var(--cp-white)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.35)',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          textAlign: 'center',
        }}
      >
        {/* Ícono de éxito animado */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '32px',
            backgroundColor: 'var(--cp-green)',
            color: '#FFFFFF',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>

        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '24px',
              lineHeight: '28px',
              color: 'var(--cp-navy)',
            }}
          >
            ¡Gracias, {pedidoConfirmado.clienteNombre}!
          </h2>
          <div
            style={{
              marginTop: '6px',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--cp-rust)',
            }}
          >
            Recibimos tu pedido #{pedidoConfirmado.codigo}
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '13px',
              lineHeight: '18px',
              color: 'var(--cp-soft)',
            }}
          >
            {pedidoConfirmado.mensaje || 'Un asesor te escribirá para coordinar el pago'}
          </p>
        </div>

        {/* Resumen del pedido */}
        <div
          style={{
            backgroundColor: 'var(--cp-sand)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Modalidad</span>
            <span style={{ fontWeight: 700 }}>
              {pedidoConfirmado.modalidad === 'DELIVERY' ? 'Delivery' : 'Recojo en local'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 700 }}>
              S/ {Number(pedidoConfirmado.subtotal).toFixed(2)}
            </span>
          </div>

          {pedidoConfirmado.envio !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Envío</span>
              <span style={{ fontWeight: 700 }}>
                {Number(pedidoConfirmado.envio) === 0
                  ? 'GRATIS'
                  : `S/ ${Number(pedidoConfirmado.envio).toFixed(2)}`}
              </span>
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid var(--cp-line)',
              paddingTop: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '16px',
              color: 'var(--cp-navy)',
            }}
          >
            <span>Total</span>
            <span style={{ color: 'var(--cp-rust)' }}>
              S/ {Number(pedidoConfirmado.total).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Pasos de preparación */}
        <div
          style={{
            backgroundColor: 'var(--cp-cream)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '14px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {pasos.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: p.completo
                    ? 'var(--cp-green)'
                    : p.activo
                    ? 'var(--cp-orange)'
                    : 'var(--cp-line)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                {p.completo ? <Icono nombre="check" /> : idx + 1}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: p.activo ? 700 : 500,
                  color: p.activo ? 'var(--cp-navy)' : 'var(--cp-soft)',
                }}
              >
                {p.n}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPedidoConfirmado(null)}
          style={{
            width: '100%',
            minHeight: '50px',
            borderRadius: '12px',
            border: 0,
            backgroundColor: 'var(--cp-orange)',
            color: '#FFFFFF',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '15px',
          }}
        >
          Volver a la carta
        </button>
      </div>
    </div>
  );
}
