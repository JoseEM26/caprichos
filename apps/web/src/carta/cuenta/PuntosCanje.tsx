import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useCuenta } from './CuentaContext';

interface PropsPuntosCanje {
  totalPedido: number;
  puntosAplicados: number;
  alAplicar: (puntos: number) => void;
}

const contenedor: CSSProperties = {
  background: 'var(--card, var(--cp-cream, #FFFBF5))',
  border: '1px solid var(--line, var(--cp-line, #E5D6C5))',
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  color: 'var(--ink, var(--cp-navy, #0B2C3E))',
};

const campo: CSSProperties = {
  flex: '1 1 0%',
  minWidth: 0,
  boxSizing: 'border-box',
  minHeight: 44,
  borderRadius: 12,
  border: '1.5px solid var(--line, var(--cp-line, #E5D6C5))',
  background: 'var(--bg, #FFFFFF)',
  color: 'var(--ink, var(--cp-navy, #0B2C3E))',
  padding: '0 12px',
  fontSize: 14,
};

const botonAplicar: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  border: 0,
  borderRadius: 12,
  background: 'var(--accent, var(--cp-orange, #E26A2C))',
  color: 'var(--on, #FFFFFF)',
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'Montserrat, sans-serif',
};

const botonIngresar: CSSProperties = {
  minHeight: 48,
  border: '1.5px solid var(--ink, var(--cp-navy, #0B2C3E))',
  borderRadius: 12,
  background: 'transparent',
  color: 'var(--ink, var(--cp-navy, #0B2C3E))',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'Montserrat, sans-serif',
};

/**
 * Componente de canje de puntos en el paso de pago (DT-55, RQ-CLI-02-11, mockup Main.dc.html).
 */
export function PuntosCanje({ totalPedido, puntosAplicados, alAplicar }: PropsPuntosCanje) {
  const { cliente, abrirPanel } = useCuenta();
  const [valorInput, setValorInput] = useState(puntosAplicados > 0 ? String(puntosAplicados) : '');
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'error' | 'ok' } | null>(null);

  if (!cliente) {
    return (
      <div style={contenedor}>
        <div style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600 }}>
          Ingresa con tu cuenta para usar tus puntos acumulados o sumar en este pedido.
        </div>
        <button type="button" onClick={abrirPanel} style={botonIngresar}>
          Ingresar con mi DNI
        </button>
      </div>
    );
  }

  const saldoDisponible = cliente.puntos;
  const numInput = parseFloat(valorInput.replace(',', '.')) || 0;
  const saldoRestante = Math.max(0, Math.round((saldoDisponible - numInput) * 100) / 100);

  const aplicar = () => {
    setMensaje(null);
    if (isNaN(numInput) || numInput <= 0) {
      alAplicar(0);
      setValorInput('');
      setMensaje({ texto: 'Se quitaron los puntos del pedido.', tipo: 'ok' });
      return;
    }

    if (numInput > saldoDisponible) {
      setMensaje({
        texto: `Solo tienes ${saldoDisponible.toFixed(2)} puntos.`,
        tipo: 'error',
      });
      return;
    }

    if (numInput > totalPedido) {
      setMensaje({
        texto: `Solo puedes usar hasta S/ ${totalPedido.toFixed(2)} en puntos: se aplican a productos sin promoción ni descuento.`,
        tipo: 'error',
      });
      return;
    }

    alAplicar(numInput);
    setMensaje({
      texto: `¡Aplicado! Se descontaron S/ ${numInput.toFixed(2)} de tu pedido.`,
      tipo: 'ok',
    });
  };

  const quitar = () => {
    alAplicar(0);
    setValorInput('');
    setMensaje({ texto: 'Se retiró el canje de puntos.', tipo: 'ok' });
  };

  return (
    <div style={contenedor}>
      <div style={{ fontSize: 13, lineHeight: '18px' }}>
        Pides con la cuenta de <b>{cliente.nombre}</b> · DNI {cliente.dniMascara}
      </div>

      <div style={{ borderTop: '1px solid var(--line, var(--cp-line, #E5D6C5))', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="f-canje" style={{ fontWeight: 700, fontSize: 13 }}>
          ¿Cuántos puntos deseas usar?
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="f-canje"
            type="text"
            inputMode="decimal"
            value={valorInput}
            onChange={(e) => {
              setValorInput(e.target.value);
              setMensaje(null);
            }}
            placeholder="0"
            style={campo}
          />
          <button type="button" onClick={aplicar} style={botonAplicar}>
            Aplicar
          </button>
          {puntosAplicados > 0 && (
            <button
              type="button"
              onClick={quitar}
              style={{
                ...botonAplicar,
                background: 'transparent',
                color: 'var(--ink, var(--cp-navy, #0B2C3E))',
                border: '1.5px solid var(--line, var(--cp-line, #E5D6C5))',
              }}
            >
              Quitar
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--soft, var(--cp-soft, #5A6D7C))' }}>
          Tienes <b>{saldoDisponible.toFixed(2)}</b> puntos disponibles.{' '}
          {numInput > 0 && numInput <= saldoDisponible && `Te quedan ${saldoRestante.toFixed(2)} puntos.`}
        </div>

        {mensaje && (
          <div
            role="status"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: mensaje.tipo === 'error' ? 'var(--cp-rust, #C44536)' : 'var(--cp-ok, #2F9E57)',
            }}
          >
            {mensaje.texto}
          </div>
        )}
      </div>
    </div>
  );
}
