import React from 'react';

export interface CampoCodigoSupervisorProps {
  valor: string;
  onChange?: (valor: string) => void;
  alCambiar?: (valor: string) => void;
  error?: string | null;
  deshabilitado?: boolean;
  id?: string;
  autoFocus?: boolean;
  ayuda?: string;
  etiqueta?: string;
  dataTestId?: string;
}

export function CampoCodigoSupervisor({
  valor,
  onChange,
  alCambiar,
  error,
  deshabilitado = false,
  id = 'codigo-supervisor-input',
  autoFocus = false,
  ayuda = 'Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos',
  etiqueta = 'Código del supervisor (6 dígitos)',
  dataTestId,
}: CampoCodigoSupervisorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange?.(soloNumeros);
    alCambiar?.(soloNumeros);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--cp-navy, #1B2541)',
        }}
      >
        {etiqueta}
      </label>

      <input
        id={id}
        name="codigoSupervisor"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-testid={dataTestId || (id === 'pin-supervisor-input' ? 'pin-supervisor-input' : 'input-codigo-supervisor')}
        value={valor}
        onChange={handleChange}
        disabled={deshabilitado}
        autoFocus={autoFocus}
        placeholder="••••••"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: '44px',
          padding: '8px 12px',
          fontSize: '20px',
          fontFamily: 'Montserrat, monospace',
          fontWeight: 800,
          letterSpacing: '6px',
          textAlign: 'center',
          color: 'var(--cp-navy, #1B2541)',
          background: deshabilitado ? 'var(--cp-cream, #F7F5EE)' : 'var(--cp-white, #FFFFFF)',
          border: `1.5px solid ${error ? 'var(--cp-wine, #8B1E3F)' : 'var(--cp-line, #D6D1C4)'}`,
          borderRadius: '8px',
          outline: 'none',
          transition: 'border-color 0.15s ease',
        }}
      />

      {error ? (
        <span
          role="alert"
          style={{
            fontSize: '12px',
            color: 'var(--cp-wine, #8B1E3F)',
            fontWeight: 600,
          }}
        >
          {error}
        </span>
      ) : (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--cp-soft, #6E717C)',
            lineHeight: 1.3,
          }}
        >
          {ayuda}
        </span>
      )}
    </div>
  );
}
