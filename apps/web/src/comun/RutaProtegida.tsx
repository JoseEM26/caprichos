import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from './sesion';
import { Cargando } from './Cargando';
import { Boton } from './Boton';

export interface RutaProtegidaProps {
  children: ReactNode;
  permiso?: string;
}

export function RutaProtegida({ children, permiso }: RutaProtegidaProps) {
  const { usuario, cargando, debeCambiar, tiene } = useSesion();
  const location = useLocation();
  const navigate = useNavigate();

  if (cargando) {
    return <Cargando mensaje="Comprobando sesión..." pantallaCompleta />;
  }

  if (!usuario) {
    return <Navigate to="/admin/ingresar" replace state={{ desde: location.pathname }} />;
  }

  if (debeCambiar && location.pathname !== '/admin/cambiar-clave') {
    return <Navigate to="/admin/cambiar-clave" replace />;
  }

  if (permiso && !tiene(permiso)) {
    return (
      <div
        role="region"
        aria-label="No tienes permiso"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: '60vh',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '32px',
            background: '#FBEDE9',
            border: '2px solid var(--cp-rust)',
            color: 'var(--cp-rust)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 800,
          }}
        >
          !
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            No tienes permiso
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--cp-soft)',
              maxWidth: '420px',
              lineHeight: '20px',
            }}
          >
            Tu rol actual no tiene acceso a este módulo o acción ({permiso}).
            Si necesitas acceso, solicita autorización al administrador.
          </p>
        </div>

        <Boton
          variante="primario"
          onClick={() => navigate('/admin')}
          style={{ marginTop: '8px' }}
        >
          Volver al escritorio
        </Boton>
      </div>
    );
  }

  return <>{children}</>;
}
