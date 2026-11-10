import { motivoSinCanje, topeCanjeLocal } from './puntosLocal';

interface Props {
  tieneCuenta: boolean;
  /** Saldo de la cuenta elegida */
  saldo: number;
  /** Monto elegible del pedido (viene de la vista previa del servidor); null = aún sin calcular */
  canjeable: number | null;
  personal: boolean;
  cupon: boolean;
  /** Texto del campo (los puntos a canjear; vacío = 0) */
  valor: string;
  alCambiar: (texto: string) => void;
}

/** «Canjear puntos» del Nuevo pedido de Caja y mozo: saldo, monto (0 por defecto) y «Usar máximo». */
export function CanjePuntosLocal({ tieneCuenta, saldo, canjeable, personal, cupon, valor, alCambiar }: Props) {
  const motivo = motivoSinCanje({ personal, cupon, tieneCuenta, saldo, canjeable });
  const tope = topeCanjeLocal(saldo, canjeable);
  const n = parseInt(valor, 10) || 0;
  const error = !motivo && n > tope ? `Solo puedes canjear hasta ${tope} ${tope === 1 ? 'punto' : 'puntos'} en este pedido.` : null;
  return (
    <div className="np-canje-puntos" data-testid="canje-puntos-local" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>
        Canjear puntos{tieneCuenta ? <span style={{ fontWeight: 600, color: 'var(--cp-soft)' }}> · saldo {Math.floor(saldo)} pts</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Puntos a canjear"
          value={valor}
          disabled={!!motivo}
          placeholder="0"
          onChange={(e) => alCambiar(e.target.value.replace(/\D/g, ''))}
          style={{ flex: 1, minWidth: 0, minHeight: 38, borderRadius: 8, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', padding: '0 10px', fontSize: 13 }}
        />
        <button
          type="button"
          disabled={!!motivo}
          onClick={() => alCambiar(String(tope))}
          style={{ minHeight: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12, cursor: motivo ? 'not-allowed' : 'pointer', opacity: motivo ? 0.5 : 1 }}
        >
          Usar máximo{!motivo ? ` (${tope})` : ''}
        </button>
      </div>
      {motivo && <div role="note" style={{ fontSize: 11, color: 'var(--cp-soft)' }}>{motivo}</div>}
      {error && <div role="alert" style={{ fontSize: 11, color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</div>}
    </div>
  );
}
