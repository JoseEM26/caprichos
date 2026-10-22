import { useEffect } from 'react';
import { useCarrito } from './CarritoContext';

export function NotificacionAgregado() {
  const { notificacion, cerrarToast, abrirCajon } = useCarrito();

  useEffect(() => {
    if (!notificacion) return;
    const timer = setTimeout(() => {
      cerrarToast();
    }, 3200);
    return () => clearTimeout(timer);
  }, [notificacion, cerrarToast]);

  if (!notificacion) return null;

  const iniciales = notificacion.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(390px, calc(100% - 24px))',
        zIndex: 90,
        backgroundColor: 'var(--cp-white)',
        color: 'var(--cp-navy)',
        border: '1.5px solid var(--cp-line)',
        borderRadius: '16px',
        boxShadow: '0 14px 34px rgba(11, 44, 62, 0.2)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          padding: '12px 14px',
        }}
      >
        <div style={{ position: 'relative', flex: 'none', width: '52px', height: '52px' }}>
          {notificacion.fotoUrl ? (
            <img
              src={notificacion.fotoUrl}
              alt=""
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '10px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '10px',
                backgroundColor: 'var(--cp-sand)',
                color: 'var(--cp-navy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '18px',
              }}
            >
              {iniciales}
            </div>
          )}
          <span
            style={{
              position: 'absolute',
              right: '-4px',
              bottom: '-4px',
              width: '22px',
              height: '22px',
              borderRadius: '11px',
              backgroundColor: 'var(--cp-ok, #2F9E57)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--cp-white)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: 'var(--cp-green)',
            }}
          >
            AGREGADO A TU PEDIDO
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '14px',
              lineHeight: '18px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notificacion.nombre}
          </div>
          <div
            style={{
              fontSize: '12px',
              lineHeight: '16px',
              color: 'var(--cp-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notificacion.detalle}
          </div>
        </div>

        <button
          onClick={abrirCajon}
          style={{
            flex: 'none',
            minHeight: '40px',
            padding: '0 12px',
            border: 0,
            borderRadius: '10px',
            backgroundColor: 'var(--cp-orange)',
            color: '#FFFFFF',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '12px',
          }}
        >
          Ver pedido
        </button>
      </div>

      <div style={{ height: '3px', backgroundColor: 'var(--cp-line)' }}>
        <div
          style={{
            height: '3px',
            backgroundColor: 'var(--cp-orange)',
            width: '100%',
            animation: 'cp-progress 3.2s linear forwards',
          }}
        />
      </div>
    </div>
  );
}
