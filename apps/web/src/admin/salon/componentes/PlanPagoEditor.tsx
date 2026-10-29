import { useEffect, useRef } from 'react';
import {
  MEDIOS_PLAN,
  errorPlan,
  montoEfectivoPlan,
  nombreMedio,
  restantePlan,
  aPlan,
  type FilaPlan,
  type MedioPlan,
} from '../../pedidos/planPago';

export interface PlanPagoEditorProps {
  /** Total del pedido: el plan debe sumarlo. */
  total: number;
  filas: FilaPlan[];
  onChange: (filas: FilaPlan[]) => void;
  /** Con cuánto paga en efectivo (solo si hay una fila de EFECTIVO). Texto para el input. */
  pagaCon: string;
  onPagaCon: (valor: string) => void;
}

const BOTON_MIN = '44px';

/**
 * Editor de pago (un medio o pago dividido). Lo usan el alta de mesa, llevar y delivery.
 * Con una sola fila sigue al total; con varias, el mozo reparte el monto y ve lo que falta.
 */
export function PlanPagoEditor({ total, filas, onChange, pagaCon, onPagaCon }: PlanPagoEditorProps) {
  const totalAnterior = useRef<number | null>(null);

  // Un solo medio: acompaña al total al montar y cada vez que cambia (no pisa lo que escribe el mozo)
  useEffect(() => {
    const previo = totalAnterior.current;
    totalAnterior.current = total;
    if (filas.length !== 1 || previo === total) return;
    const esperado = total > 0 ? total.toFixed(2) : '';
    if (filas[0].monto !== esperado) onChange([{ medio: filas[0].medio, monto: esperado }]);
  }, [total, filas, onChange]);

  const restante = restantePlan(total, filas);
  const error = total > 0 ? errorPlan(total, filas) : null;
  const montoEf = montoEfectivoPlan(aPlan(filas));
  const hayEfectivo = filas.some((f) => f.medio === 'EFECTIVO');
  const pagaConNum = Number(pagaCon);
  const vuelto = hayEfectivo && pagaCon !== '' && pagaConNum >= montoEf ? pagaConNum - montoEf : null;

  const cambiarFila = (indice: number, cambios: Partial<FilaPlan>) => {
    onChange(filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  };

  const agregarMedio = () => {
    const usados = new Set(filas.map((f) => f.medio));
    const libre = MEDIOS_PLAN.find((m) => !usados.has(m.id))?.id ?? 'YAPE';
    const monto = restante > 0 ? restante.toFixed(2) : '';
    onChange([...filas, { medio: libre, monto }]);
  };

  const quitarFila = (indice: number) => {
    onChange(filas.filter((_, i) => i !== indice));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontWeight: 700, fontSize: '13px' }}>¿Cómo paga?</div>

      {filas.map((fila, indice) => (
        <div
          key={indice}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px', borderBottom: filas.length > 1 ? '1px dashed var(--cp-line)' : 'none' }}
        >
          <div
            role="group"
            aria-label={indice === 0 ? '¿Cómo paga?' : `Medio ${indice + 1} del pago`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          >
            {MEDIOS_PLAN.map((m) => {
              const activo = fila.medio === m.id;
              const usadoEnOtraFila = filas.some((otra, j) => j !== indice && otra.medio === m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={activo}
                  disabled={usadoEnOtraFila}
                  onClick={() => cambiarFila(indice, { medio: m.id as MedioPlan })}
                  style={{
                    minHeight: BOTON_MIN,
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: activo ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)',
                    background: activo ? 'var(--cp-navy)' : 'var(--cp-white)',
                    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: usadoEnOtraFila ? 'not-allowed' : 'pointer',
                    opacity: usadoEnOtraFila ? 0.4 : 1,
                  }}
                >
                  {m.nombre}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, minWidth: '64px' }}>
              {nombreMedio(fila.medio)}
                          </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 700 }}>S/</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                aria-label={`Monto en ${nombreMedio(fila.medio)}`}
                value={fila.monto}
                onChange={(e) => cambiarFila(indice, { monto: e.target.value })}
                style={{
                  width: '110px',
                  minHeight: BOTON_MIN,
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontSize: '14px',
                }}
              />
            </div>
            {filas.length > 1 && (
              <button
                type="button"
                onClick={() => quitarFila(indice)}
                aria-label={`Quitar ${nombreMedio(fila.medio)}`}
                style={{
                  minHeight: BOTON_MIN,
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      ))}

      {filas.length < MEDIOS_PLAN.length && total > 0 && (
        <button
          type="button"
          onClick={agregarMedio}
          style={{
            minHeight: BOTON_MIN,
            borderRadius: '10px',
            border: '1.5px dashed var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Agregar medio
        </button>
      )}

      {total > 0 && (
        <div
          role={error ? 'alert' : undefined}
          style={{ fontSize: '13px', fontWeight: 700, color: error ? 'var(--cp-rojo, #B42318)' : 'var(--cp-soft)' }}
        >
          {error ?? 'El plan cubre el total'}
        </div>
      )}

      {hayEfectivo && (
        <div>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            ¿Con cuánto paga en efectivo?
          </label>
          <input
            type="number"
            step="0.50"
            min="0"
            value={pagaCon}
            onChange={(e) => onPagaCon(e.target.value)}
            placeholder={montoEf > 0 ? `Opcional, mínimo S/ ${montoEf.toFixed(2)}` : 'Opcional'}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: BOTON_MIN,
              borderRadius: '10px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: '14px',
            }}
          />
          {vuelto !== null && (
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>Vuelto S/ {vuelto.toFixed(2)}</div>
          )}
        </div>
      )}
    </div>
  );
}
