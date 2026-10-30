import { Boton } from './Boton';

export interface EstadoErrorProps {
  titulo?: string;
  mensaje: string;
  alReintentar?: () => void;
}

export function EstadoError({
  titulo = 'Ocurrió un problema',
  mensaje,
  alReintentar,
}: EstadoErrorProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        textAlign: 'center',
        background: '#FBEDE9',
        border: '1.5px solid var(--cp-rust)',
        borderRadius: '16px',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '15px',
          color: 'var(--cp-rust)',
        }}
      >
        {titulo}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: 'var(--cp-navy)',
          maxWidth: '420px',
          lineHeight: '18px',
        }}
      >
        {mensaje}
      </div>
      {alReintentar && (
        <div style={{ marginTop: '8px' }}>
          <Boton
            variante="secundario"
            tamano="pequeno"
            onClick={alReintentar}
            style={{ borderColor: 'var(--cp-rust)', color: 'var(--cp-rust)' }}
          >
            Reintentar
          </Boton>
        </div>
      )}
    </div>
  );
}
