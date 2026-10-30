import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useCuenta } from './CuentaContext';

interface PropsPuntosCanje {
  totalPedido: number;
  puntosAplicados: number;
  alAplicar: (puntos: number) => void;
  /** puntos_porcentaje del servidor (5 por defecto) */
  porcentaje?: number;
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
 * Puntos que ganará el pedido: misma base que el servidor (productos sin promoción menos lo pagado con puntos),
 * 0 con cupón. `delServidor` es el estimado de la vista previa cuando no hay canje.
 */
export function estimarPuntos(p: { canjeable: number | null; porcentaje: number; puntosAplicados: number; conCupon: boolean; delServidor?: number | null }): number {
  if (p.conCupon) return 0;
  if (p.puntosAplicados <= 0 && typeof p.delServidor === 'number') return p.delServidor;
  return Math.round(Math.max(0, (p.canjeable ?? 0) - p.puntosAplicados) * (p.porcentaje / 100) * 100) / 100;
}

/**
 * Componente de canje de puntos en el paso de pago (DT-55, RQ-CLI-02-11, mockup Main.dc.html).
 */
export function PuntosCanje({ totalPedido, puntosAplicados, alAplicar, porcentaje = 5 }: PropsPuntosCanje) {
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
          Ingresar con mi celular
        </button>
      </div>
    );
  }

  const saldoDisponible = cliente.puntos;
  // Los puntos se ganan con decimales (5 % del total) pero se usan en números enteros, para que el cliente
  // sepa exactamente cuánto descuenta; la fracción que sobra se queda en su saldo.
  const maximoUsable = Math.floor(Math.min(saldoDisponible, totalPedido) + 1e-9);
  const numInput = parseInt(valorInput, 10) || 0;
  const saldoRestante = Math.max(0, Math.round((saldoDisponible - numInput) * 100) / 100);

  // sin puntos no hay nada que canjear, pero se explica cómo ganarlos
  if (saldoDisponible <= 0 && puntosAplicados <= 0) {
    return (
      <div style={contenedor}>
        <div style={{ fontSize: 13, lineHeight: '18px' }}>
          Tienes <b>0 puntos</b>. Ganas {porcentaje} % de lo que pagas en productos sin promoción; se suman cuando Caja cobra tu pedido.
        </div>
      </div>
    );
  }

  if (maximoUsable < 1 && puntosAplicados <= 0) {
    return (
      <div style={contenedor}>
        <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--soft, var(--cp-soft, #5A6D7C))' }}>
          Tienes <b>{saldoDisponible.toFixed(2)}</b> puntos. Se pueden usar desde 1 punto, en productos sin promoción ni descuento.
        </div>
      </div>
    );
  }

  const aplicar = () => {
    setMensaje(null);
    if (numInput <= 0) {
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

    if (numInput > maximoUsable) {
      setMensaje({
        texto: `Solo puedes usar hasta ${maximoUsable} ${maximoUsable === 1 ? 'punto' : 'puntos'} en este pedido: se aplican a productos sin promoción ni descuento.`,
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
        Pides con la cuenta de <b>{cliente.nombre}</b>
      </div>

      <div style={{ borderTop: '1px solid var(--line, var(--cp-line, #E5D6C5))', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="f-canje" style={{ fontWeight: 700, fontSize: 13 }}>
          ¿Cuántos puntos deseas usar?
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="f-canje"
            type="text"
            inputMode="numeric"
            value={valorInput}
            onChange={(e) => {
              setValorInput(e.target.value.replace(/\D/g, '').slice(0, 5));
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
          Tienes <b>{saldoDisponible.toFixed(2)}</b> puntos. Puedes usar hasta <b>{maximoUsable}</b>, en números enteros.{' '}
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
