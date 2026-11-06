import type { CSSProperties } from 'react';
import {
  Reparto,
  SaborMezcla,
  UMBRAL_QUEDAN_SABOR,
  faltanUnidades,
  todasDeUn,
  topeParaSabor,
  totalElegido,
} from './saboresMezcla';

interface Props {
  sabores: SaborMezcla[];
  /** Unidades a repartir: unidades del tamaño × cantidad de la línea. */
  total: number;
  valor: Reparto;
  onCambio: (valor: Reparto) => void;
  deshabilitar?: boolean;
}

const boton: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  borderRadius: 22,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
};

const chip: CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 9999,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

/**
 * Reparto de las unidades de una media docena o docena entre los sabores disponibles.
 * Los agotados no se muestran; cada sabor tiene tope por lo que queda.
 */
export function SelectorSaboresMezcla({ sabores, total, valor, onCambio, deshabilitar = false }: Props) {
  if (total <= 0) return null;

  const visibles = sabores.filter((s) => s.disponible && (s.quedan === null || s.quedan > 0));
  const elegidas = totalElegido(valor);
  const faltan = faltanUnidades(valor, total);
  const sobran = Math.max(0, elegidas - total);
  const completo = elegidas === total;
  const porcentaje = Math.min(100, Math.round((Math.min(elegidas, total) / total) * 100));

  const fijar = (saborId: string, cantidad: number) => {
    const nuevo: Reparto = { ...valor };
    if (cantidad > 0) nuevo[saborId] = cantidad;
    else delete nuevo[saborId];
    onCambio(nuevo);
  };

  return (
    <div role="group" aria-label="Sabores de la mezcla" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--cp-navy)' }}>{`Elegidas ${elegidas} de ${total}`}</span>
          {completo ? (
            <span style={{ fontWeight: 800, fontSize: 12, color: '#2F9E57' }}>Completo ✓</span>
          ) : sobran > 0 ? (
            <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--cp-rust)' }}>{`Sobran ${sobran}: quita unidades`}</span>
          ) : (
            <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--cp-rust)' }}>{`Faltan ${faltan}`}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCambio({})}
          disabled={deshabilitar || elegidas === 0}
          style={{ ...chip, minHeight: 40, opacity: elegidas === 0 ? 0.5 : 1 }}
        >
          Limpiar
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Sabores elegidos"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(elegidas, total)}
        style={{ height: 8, borderRadius: 4, background: 'var(--cp-line)', overflow: 'hidden' }}
      >
        <div style={{ width: `${porcentaje}%`, height: '100%', background: completo ? '#2F9E57' : 'var(--cp-orange)', transition: 'width 150ms' }} />
      </div>

      {visibles.length === 0 ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)' }}>No hay sabores disponibles ahora.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Todas del mismo sabor:</span>
            {visibles.map((s) => {
              const cabe = s.quedan === null || s.quedan >= total;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onCambio(todasDeUn(s.id, total))}
                  disabled={deshabilitar || !cabe}
                  aria-label={`Todas del mismo sabor: ${s.nombre}`}
                  title={cabe ? undefined : `Solo quedan ${s.quedan} de ${s.nombre}`}
                  style={{ ...chip, opacity: cabe ? 1 : 0.45 }}
                >
                  {s.nombre}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibles.map((s) => {
              const cantidad = valor[s.id] ?? 0;
              const tope = topeParaSabor(valor, s.id, s, total);
              const puedeMas = !deshabilitar && cantidad < tope;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                    minHeight: 52,
                    padding: '6px 10px',
                    borderRadius: 14,
                    border: `1.5px solid ${cantidad > 0 ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                    background: 'var(--cp-white)',
                  }}
                >
                  <div style={{ flex: '1 1 120px', minWidth: 0, overflowWrap: 'anywhere' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--cp-navy)' }}>{s.nombre}</span>
                    {s.quedan !== null && s.quedan <= UMBRAL_QUEDAN_SABOR && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--cp-soft)' }}>{`Quedan ${s.quedan}`}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                    <button
                      type="button"
                      onClick={() => fijar(s.id, cantidad - 1)}
                      disabled={deshabilitar || cantidad === 0}
                      aria-label={`Quitar una de ${s.nombre}`}
                      style={{ ...boton, opacity: cantidad === 0 ? 0.4 : 1 }}
                    >
                      −
                    </button>
                    <output aria-label={`Cantidad de ${s.nombre}`} style={{ minWidth: 28, textAlign: 'center', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>
                      {cantidad}
                    </output>
                    <button
                      type="button"
                      onClick={() => fijar(s.id, cantidad + 1)}
                      disabled={!puedeMas}
                      aria-label={`Agregar una de ${s.nombre}`}
                      style={{ ...boton, opacity: puedeMas ? 1 : 0.4 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
