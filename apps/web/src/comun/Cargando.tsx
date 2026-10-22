export interface CargandoProps {
  mensaje?: string;
  pantallaCompleta?: boolean;
}

export function Cargando({
  mensaje = 'Cargando',
  pantallaCompleta = false,
}: CargandoProps) {
  const contenido = (
    <div
      role="status"
      aria-label={mensaje}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '24px',
      }}
    >
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '4px solid var(--cp-sand)',
            borderTopColor: 'var(--cp-orange)',
            animation: 'cp-spin 0.9s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '12px',
            top: '12px',
            width: '44px',
            height: '44px',
            borderRadius: '22px',
            background: 'var(--cp-sand)',
            color: 'var(--cp-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '18px',
            animation: 'cp-pulse 1.4s ease-in-out infinite',
          }}
        >
          C
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '14px',
          letterSpacing: '0.06em',
          color: 'var(--cp-navy)',
        }}
      >
        {mensaje}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--cp-orange)',
            animation: 'cp-dot 1s infinite',
          }}
        />
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--cp-orange)',
            animation: 'cp-dot 1s 0.15s infinite',
          }}
        />
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--cp-orange)',
            animation: 'cp-dot 1s 0.3s infinite',
          }}
        />
      </div>
    </div>
  );

  if (pantallaCompleta) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 95,
          background: 'var(--cp-cream)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {contenido}
      </div>
    );
  }

  return contenido;
}
