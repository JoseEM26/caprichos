import type { ReactNode } from 'react';

export interface EstadoVacioProps {
  titulo?: string;
  descripcion?: string;
  accion?: ReactNode;
  icono?: ReactNode;
}

export function EstadoVacio({
  titulo = 'No hay elementos para mostrar',
  descripcion = 'Aún no se han registrado datos en esta sección.',
  accion,
  icono,
}: EstadoVacioProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 16px',
        textAlign: 'center',
        background: 'var(--cp-white)',
        border: '1.5px dashed var(--cp-line)',
        borderRadius: '16px',
        gap: '8px',
      }}
    >
      {icono && (
        <div style={{ fontSize: '32px', color: 'var(--cp-soft)', marginBottom: '4px' }}>
          {icono}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: '16px',
          color: 'var(--cp-navy)',
        }}
      >
        {titulo}
      </div>
      {descripcion && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--cp-soft)',
            maxWidth: '380px',
            lineHeight: '18px',
          }}
        >
          {descripcion}
        </div>
      )}
      {accion && <div style={{ marginTop: '12px' }}>{accion}</div>}
    </div>
  );
}
