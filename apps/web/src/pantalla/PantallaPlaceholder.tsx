import { Icono } from '../comun/Icono';

export function PantallaPlaceholder() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '36px',
          background: 'var(--cp-orange)',
          color: 'var(--cp-navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="pantallas" tamano={32} />
      </div>
      <h1
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '24px',
          color: 'var(--cp-cream)',
        }}
      >
        Pantalla de Cocina / TV
      </h1>
      <p style={{ maxWidth: '480px', fontSize: '14px', color: 'var(--cp-line2)', margin: 0 }}>
        Vista especializada para pantalla de comandas de cocina y monitor de estado de pedidos.
        En desarrollo para las siguientes olas.
      </p>
    </div>
  );
}
