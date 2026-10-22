import { Link } from 'react-router-dom';

export function PieLegal() {
  return (
    <footer
      style={{
        width: '100%',
        backgroundColor: 'var(--cp-navy)',
        color: 'var(--cp-cream)',
        padding: '24px 16px',
        marginTop: 'auto',
        borderTop: '2px solid var(--cp-orange)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '18px',
            alignItems: 'center',
          }}
        >
          <Link
            to="/legal/terminos"
            style={{
              color: 'var(--cp-cream)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            Términos y condiciones
          </Link>

          <span style={{ color: 'var(--cp-line)', opacity: 0.5 }}>|</span>

          <Link
            to="/legal/privacidad"
            style={{
              color: 'var(--cp-cream)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            Política de privacidad
          </Link>

          <span style={{ color: 'var(--cp-line)', opacity: 0.5 }}>|</span>

          <Link
            to="/reclamos"
            style={{
              color: 'var(--cp-cream)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '13px',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            Libro de reclamaciones virtual
          </Link>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--cp-line)', opacity: 0.85 }}>
          © 2026 Caprichos. Todos los derechos reservados. Conforme al D.S. 011-2011-PCM y la Ley N° 29733 de Protección de Datos Personales.
        </div>
      </div>
    </footer>
  );
}
