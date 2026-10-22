import { useState, type InputHTMLAttributes } from 'react';

export interface CampoProps
  extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta?: string;
  error?: string;
  ayuda?: string;
  permiteAlternarClave?: boolean;
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  id,
  type = 'text',
  permiteAlternarClave = false,
  style,
  ...resto
}: CampoProps) {
  const [mostrarClave, setMostrarClave] = useState(false);
  const inputId = id || (etiqueta ? `campo-${etiqueta.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const esPassword = type === 'password';
  const tipoFinal = esPassword && permiteAlternarClave ? (mostrarClave ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {etiqueta && (
        <label
          htmlFor={inputId}
          style={{
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--cp-navy)',
          }}
        >
          {etiqueta}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={inputId}
          type={tipoFinal}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: '48px',
            borderRadius: '12px',
            border: `1.5px solid ${error ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
            background: 'var(--cp-white)',
            color: 'var(--cp-navy)',
            padding: esPassword && permiteAlternarClave ? '0 48px 0 12px' : '0 12px',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'inherit',
            ...style,
          }}
          {...resto}
        />

        {esPassword && permiteAlternarClave && (
          <button
            type="button"
            onClick={() => setMostrarClave((v) => !v)}
            aria-label={mostrarClave ? 'Ocultar contraseña' : 'Ver contraseña'}
            style={{
              position: 'absolute',
              right: '8px',
              minHeight: '36px',
              height: '36px',
              padding: '0 8px',
              border: 0,
              background: 'transparent',
              color: 'var(--cp-soft)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {mostrarClave ? 'Ocultar' : 'Ver'}
          </button>
        )}
      </div>

      {error && (
        <span
          role="alert"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--cp-rust)',
            lineHeight: '16px',
          }}
        >
          {error}
        </span>
      )}

      {ayuda && !error && (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--cp-soft)',
            lineHeight: '16px',
          }}
        >
          {ayuda}
        </span>
      )}
    </div>
  );
}
