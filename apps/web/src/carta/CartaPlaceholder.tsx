import { useNavigate } from 'react-router-dom';
import { Boton } from '../comun/Boton';

export function CartaPlaceholder() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        background: 'var(--cp-cream)',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '36px',
          background: 'var(--cp-sand)',
          color: 'var(--cp-orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '32px',
        }}
      >
        C
      </div>
      <h1
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '26px',
          color: 'var(--cp-navy)',
        }}
      >
        Caprichos — Carta Virtual
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: '15px',
          color: 'var(--cp-soft)',
          maxWidth: '460px',
        }}
      >
        Bienvenido a la carta digital de Caprichos Café Artesanal.
        La carta pública interactiva se integrará en la ola correspondiente.
      </p>

      <div style={{ marginTop: '12px' }}>
        <Boton variante="primario" onClick={() => navigate('/admin')}>
          Ir al Panel Administrativo
        </Boton>
      </div>
    </div>
  );
}
