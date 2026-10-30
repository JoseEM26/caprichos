import { Boton } from '../comun/Boton';
import { Icono } from '../comun/Icono';
import { useNavigate } from 'react-router-dom';

export interface ProximamenteProps {
  nombre?: string;
  descripcion?: string;
}

export function Proximamente({
  nombre = 'Módulo en desarrollo',
  descripcion = 'Este módulo estará disponible próximamente en las siguientes fases de la ola.',
}: ProximamenteProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        background: 'var(--cp-white)',
        border: '1.5px dashed var(--cp-line)',
        borderRadius: '20px',
        margin: '16px auto',
        maxWidth: '560px',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: 'var(--cp-sand)',
          color: 'var(--cp-orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="estrella" tamano={24} />
      </div>
      <h2
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '20px',
          color: 'var(--cp-navy)',
        }}
      >
        {nombre} — Próximamente
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '20px',
          color: 'var(--cp-soft)',
        }}
      >
        {descripcion}
      </p>
      <Boton
        variante="secundario"
        onClick={() => navigate('/admin')}
        style={{ marginTop: '8px' }}
      >
        Volver al escritorio
      </Boton>
    </div>
  );
}
