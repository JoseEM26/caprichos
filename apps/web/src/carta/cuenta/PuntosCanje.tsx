import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCuenta } from './CuentaContext';

interface PropsPuntosCanje {
  totalPedido: number;
  puntosAplicados: number;
  alAplicar: (puntos: number) => void;
  /** puntos_porcentaje del servidor (5 por defecto) */
  porcentaje?: number;
  /** Por qué no se pueden usar (p. ej. descuento del equipo); si no llega, se explica por saldo o promoción */
  motivoNoAplica?: string;
}

const contenedor: CSSProperties = {
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

const PAUSA_CANJE_MS = 250;

/** Valida lo escrito: 0 si está vacío, y un error si pasa del saldo o del tope usable. */
function evaluarPuntos(texto: string, saldo: number, maximo: number): { puntos: number; error: string | null } {
  const n = parseInt(texto, 10) || 0;
  if (n <= 0) return { puntos: 0, error: null };
  if (n > saldo) return { puntos: 0, error: `Solo tienes ${saldo.toFixed(2)} puntos.` };
  if (n > maximo) {
    return {
      puntos: 0,
      error: `Solo puedes usar hasta ${maximo} ${maximo === 1 ? 'punto' : 'puntos'} en este pedido: se aplican a productos sin promoción ni descuento.`,
    };
  }
  return { puntos: n, error: null };
}

/**
 * Componente de canje de puntos en el paso de pago (DT-55, RQ-CLI-02-11, mockup Main.dc.html).
 */
export function PuntosCanje({ totalPedido, puntosAplicados, alAplicar, porcentaje = 5, motivoNoAplica }: PropsPuntosCanje) {
  const { cliente, abrirPanel } = useCuenta();
  const [valorInput, setValorInput] = useState(puntosAplicados > 0 ? String(puntosAplicados) : '');
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

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
  const { puntos: puntosEscritos, error: errorEscritos } = evaluarPuntos(valorInput, saldoDisponible, maximoUsable);
  const numInput = parseInt(valorInput, 10) || 0;
  const saldoRestante = Math.max(0, Math.round((saldoDisponible - numInput) * 100) / 100);
  const mensaje: { texto: string; tipo: 'error' | 'ok' } | null = errorEscritos
    ? { texto: errorEscritos, tipo: 'error' }
    : puntosEscritos > 0
      ? { texto: `Se descontarán S/ ${puntosEscritos.toFixed(2)} de tu pedido.`, tipo: 'ok' }
      : null;

  // Aplica al instante lo que se escribe (si es válido), con una pausa corta para no recalcular en cada tecla.
  const cancelarPendiente = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const alEscribir = (texto: string) => {
    setValorInput(texto);
    cancelarPendiente();
    const { puntos, error } = evaluarPuntos(texto, saldoDisponible, maximoUsable);
    // inválido o vacío: vuelve a 0 de inmediato, sin estado intermedio
    if (error || puntos === 0) {
      alAplicar(0);
      return;
    }
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      alAplicar(puntos);
    }, PAUSA_CANJE_MS);
  };

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
        <div data-testid="puntos-saldo" style={{ fontSize: 13, lineHeight: '18px' }}>
          Tienes <b>{saldoDisponible.toFixed(2)}</b> puntos (= S/ {saldoDisponible.toFixed(2)})
        </div>
        <div data-testid="puntos-motivo" role="status" style={{ fontSize: 12, lineHeight: '16px', color: 'var(--soft, var(--cp-soft, #5A6D7C))' }}>
          {motivoNoAplica ??
            (saldoDisponible < 1
              ? `Te faltan ${(1 - saldoDisponible).toFixed(2)} puntos para usarlos (mínimo 1).`
              : 'Los puntos no aplican a productos con descuento del equipo o en promoción.')}
        </div>
      </div>
    );
  }

  // «Aplicar» confirma al instante (sin esperar la pausa); los errores ya se ven mientras escribe
  const aplicar = () => {
    cancelarPendiente();
    alAplicar(puntosEscritos);
  };

  const usarTodos = () => {
    cancelarPendiente();
    setValorInput(String(maximoUsable));
    alAplicar(maximoUsable);
  };

  const quitar = () => {
    cancelarPendiente();
    alAplicar(0);
    setValorInput('');
  };

  return (
    <div style={contenedor}>
      <div data-testid="puntos-saldo" style={{ fontSize: 13, lineHeight: '18px' }}>
        Tienes <b>{saldoDisponible.toFixed(2)}</b> puntos (= S/ {saldoDisponible.toFixed(2)})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button type="button" onClick={usarTodos} style={{ ...botonIngresar, minHeight: 44 }}>
          Usar mis puntos
        </button>
        <label htmlFor="f-canje" style={{ fontWeight: 700, fontSize: 13 }}>
          ¿Cuántos puntos deseas usar?
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="f-canje"
            type="text"
            inputMode="numeric"
            value={valorInput}
            onChange={(e) => alEscribir(e.target.value.replace(/\D/g, '').slice(0, 5))}
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
          Puedes usar hasta <b>{maximoUsable}</b> en este pedido.{' '}
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
