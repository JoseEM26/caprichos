import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type VarianteBoton =
  | 'primario'
  | 'secundario'
  | 'oscuro'
  | 'peligro'
  | 'texto';

export interface BotonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  cargando?: boolean;
  tamano?: 'normal' | 'grande' | 'pequeno';
}

export function Boton({
  variante = 'primario',
  cargando = false,
  tamano = 'normal',
  children,
  disabled,
  style,
  ...resto
}: BotonProps) {
  let minH = '44px';
  let padding = '0 16px';
  let fontSize = '14px';

  if (tamano === 'grande') {
    minH = '52px';
    padding = '0 20px';
    fontSize = '15px';
  } else if (tamano === 'pequeno') {
    minH = '44px';
    padding = '0 12px';
    fontSize = '13px';
  }

  const estilosBase: CSSProperties = {
    minHeight: minH,
    padding,
    fontSize,
    borderRadius: '12px',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: disabled || cargando ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 0.15s, opacity 0.15s',
    border: '0',
    fontFamily:
      variante === 'primario' || variante === 'oscuro'
        ? 'var(--fuente-titulos)'
        : 'var(--fuente-texto)',
    fontWeight: variante === 'primario' || variante === 'oscuro' ? 800 : 700,
  };

  const estilosVariante: Record<VarianteBoton, CSSProperties> = {
    primario: {
      background: 'var(--cp-orange)',
      color: 'var(--cp-navy)',
    },
    secundario: {
      background: 'transparent',
      color: 'var(--cp-navy)',
      border: '1.5px solid var(--cp-navy)',
    },
    oscuro: {
      background: 'var(--cp-navy)',
      color: 'var(--cp-cream)',
    },
    peligro: {
      background: 'var(--cp-rust)',
      color: 'var(--cp-white)',
    },
    texto: {
      background: 'transparent',
      color: 'var(--cp-navy)',
      border: '0',
    },
  };

  return (
    <button
      disabled={disabled || cargando}
      style={{
        ...estilosBase,
        ...estilosVariante[variante],
        ...style,
      }}
      {...resto}
    >
      {cargando ? (
        <>
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'cp-spin 0.8s linear infinite',
              display: 'inline-block',
            }}
          />
          <span>Cargando...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
