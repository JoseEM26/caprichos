import type { HTMLAttributes, ReactNode } from 'react';

export interface TarjetaProps extends HTMLAttributes<HTMLDivElement> {
  titulo?: string;
  subtitulo?: string;
  accion?: ReactNode;
  elevada?: boolean;
}

export function Tarjeta({
  titulo,
  subtitulo,
  accion,
  elevada = false,
  children,
  style,
  ...resto
}: TarjetaProps) {
  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '16px',
        padding: '18px',
        boxShadow: elevada ? '0 10px 30px rgba(11, 44, 62, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style,
      }}
      {...resto}
    >
      {(titulo || subtitulo || accion) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div>
            {titulo && (
              <h3
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '16px',
                  lineHeight: '22px',
                  color: 'var(--cp-navy)',
                }}
              >
                {titulo}
              </h3>
            )}
            {subtitulo && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                }}
              >
                {subtitulo}
              </p>
            )}
          </div>
          {accion && <div>{accion}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
