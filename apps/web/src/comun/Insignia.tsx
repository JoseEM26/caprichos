import type { HTMLAttributes, CSSProperties } from 'react';

export type VarianteInsignia =
  | 'neutro'
  | 'exito'
  | 'peligro'
  | 'aviso'
  | 'acento';

export interface InsigniaProps extends HTMLAttributes<HTMLSpanElement> {
  variante?: VarianteInsignia;
}

export function Insignia({
  variante = 'neutro',
  children,
  style,
  ...resto
}: InsigniaProps) {
  const estilosVariante: Record<VarianteInsignia, CSSProperties> = {
    neutro: {
      background: 'var(--cp-sand)',
      color: 'var(--cp-navy)',
      border: '1px solid var(--cp-line)',
    },
    exito: {
      background: 'var(--cp-greenbg)',
      color: 'var(--cp-green)',
      border: '1px solid var(--cp-green)',
    },
    peligro: {
      background: '#FBEDE9',
      color: 'var(--cp-rust)',
      border: '1px solid var(--cp-rust)',
    },
    aviso: {
      background: '#FFF8E6',
      color: 'var(--cp-gold)',
      border: '1px solid var(--cp-gold)',
    },
    acento: {
      background: 'var(--cp-orange)',
      color: 'var(--cp-navy)',
      border: '1px solid var(--cp-orange)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        ...estilosVariante[variante],
        ...style,
      }}
      {...resto}
    >
      {children}
    </span>
  );
}
