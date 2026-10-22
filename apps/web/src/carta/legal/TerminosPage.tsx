import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { comprobantesApi } from '../../admin/comprobantes/comprobantesApi';
import { PieLegal } from './PieLegal';

export function TerminosPage() {
  const [terminos, setTerminos] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    comprobantesApi
      .obtenerCartaLegal()
      .then((data) => {
        if (activo) {
          setTerminos(data.terminos);
          setCargando(false);
        }
      })
      .catch((err) => {
        if (activo) {
          setError(err?.message || 'Error al cargar los términos y condiciones');
          setCargando(false);
        }
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--cp-cream)',
      }}
    >
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--cp-line)',
          backgroundColor: 'var(--cp-white)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-navy)',
            textDecoration: 'none',
          }}
        >
          CAPRICHOS
        </Link>
        <Link
          to="/"
          style={{
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRadius: '8px',
            border: '1.5px solid var(--cp-navy)',
            color: 'var(--cp-navy)',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '13px',
          }}
        >
          Volver a la carta
        </Link>
      </header>

      <main style={{ flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: '26px', color: 'var(--cp-navy)', marginBottom: '8px' }}>
          Términos y Condiciones del Servicio
        </h1>
        <p style={{ color: 'var(--cp-soft)', fontSize: '14px', marginBottom: '24px' }}>
          Condiciones aplicables al uso de la carta virtual, pedidos en salón, para llevar y delivery.
        </p>

        {cargando && <Cargando mensaje="Cargando términos del servicio..." />}

        {error && <EstadoError mensaje={error} />}

        {!cargando && !error && (
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1px solid var(--cp-line)',
              padding: '24px',
              lineHeight: '24px',
              fontSize: '15px',
              whiteSpace: 'pre-wrap',
              color: 'var(--cp-navy)',
            }}
          >
            {terminos || 'No se han configurado los términos del servicio.'}
          </div>
        )}
      </main>

      <PieLegal />
    </div>
  );
}
