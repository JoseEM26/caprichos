import { useEffect } from 'react';
import {
  MEDIOS_PLAN,
  ajustarPlan,
  aPlan,
  errorPlan,
  montoEfectivoPlan,
  nombreMedio,
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
  /** Con efectivo en el plan, «con cuánto paga» es obligatorio: de ahí sale el vuelto (delivery y mesa). */
  pagaConObligatorio?: boolean;
  /** Marca el campo «¿Con cuánto paga?» en rojo (lo usa el alta de mesa tras un intento de enviar). */
  pagaConInvalido?: boolean;
}

const ALTO_TOQUE = '44px';

/**
 * Editor de pago (un medio o pago dividido). Lo usan el alta de mesa y la precuenta.
 * Un medio: paga todo el total, solo se elige el medio (y, si es efectivo, con cuánto paga).
 * «Agregar otro medio de pago»: aparecen los montos. La primera fila queda con lo que falta del total;
 * las demás se escriben y cada una tiene «Quitar». Un medio por fila; el contenedor tiene scroll propio.
 */
export function PlanPagoEditor({
  total,
  filas,
  onChange,
  pagaCon,
  onPagaCon,
  pagaConObligatorio = false,
  pagaConInvalido = false,
}: PlanPagoEditorProps) {
  // La vista siempre sale de ajustarPlan (no depende de que el padre ya haya aplicado el ajuste)
  const vista = ajustarPlan(total, filas);

  // Sincroniza el padre con el monto que cuadra (un medio = total; varios = la primera se ajusta sola)
  useEffect(() => {
    const ajustado = ajustarPlan(total, filas);
    if (ajustado !== filas) onChange(ajustado);
  }, [total, filas, onChange]);

  const multi = vista.length > 1;
  const emitir = (nuevas: FilaPlan[]) => onChange(ajustarPlan(total, nuevas));
  const cambiarFila = (indice: number, cambios: Partial<FilaPlan>) => {
    emitir(vista.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  };
  const agregarMedio = () => {
    const usados = new Set(vista.map((f) => f.medio));
    const libre = MEDIOS_PLAN.find((m) => !usados.has(m.id))?.id ?? 'YAPE';
    emitir([...vista, { medio: libre, monto: '' }]);
  };
  const quitarFila = (indice: number) => {
    emitir(vista.filter((_, i) => i !== indice));
  };

  const montoPrimera = Number(vista[0]?.monto ?? 0);
  let error: string | null = null;
  if (total > 0) {
    if (multi && montoPrimera < 0) {
      error = `Sobra S/ ${(-montoPrimera).toFixed(2)}: baja los montos de los otros medios`;
    } else if (multi && montoPrimera === 0) {
      error = `${nombreMedio(vista[0].medio)} queda en S/ 0.00: quítalo o baja el monto de los otros`;
    } else {
      error = errorPlan(total, vista);
    }
  }

  const montoEf = montoEfectivoPlan(aPlan(vista));
  const hayEfectivo = vista.some((f) => f.medio === 'EFECTIVO');
  const pagaConNum = Number(pagaCon);
  const vuelto = hayEfectivo && pagaCon !== '' && pagaConNum >= montoEf ? pagaConNum - montoEf : null;
  const resumen = aPlan(vista)
    .map((f) => `${nombreMedio(f.medio)} S/ ${f.monto.toFixed(2)}`)
    .join(' · ');

  return (
    <div
      data-testid="plan-pago-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '40vh',
        overflowY: 'auto',
        paddingRight: '2px',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '13px' }}>¿Cómo paga?</div>

      {vista.map((fila, indice) => (
        <div
          key={indice}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingBottom: multi && indice < vista.length - 1 ? '8px' : '0',
            borderBottom: multi && indice < vista.length - 1 ? '1px dashed var(--cp-line)' : 'none',
          }}
        >
          <div
            role="group"
            aria-label={indice === 0 ? '¿Cómo paga?' : `Medio ${indice + 1} del pago`}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MEDIOS_PLAN.map((m) => {
                const activo = fila.medio === m.id;
                const usadoEnOtraFila = vista.some((otra, j) => j !== indice && otra.medio === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={activo}
                    disabled={usadoEnOtraFila}
                    onClick={() => cambiarFila(indice, { medio: m.id as MedioPlan })}
                    style={{
                      minHeight: ALTO_TOQUE,
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: activo ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)',
                      background: activo ? 'var(--cp-navy)' : 'var(--cp-white)',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: usadoEnOtraFila ? 'not-allowed' : 'pointer',
                      opacity: usadoEnOtraFila ? 0.4 : 1,
                    }}
                  >
                    {m.nombre}
                  </button>
                );
              })}
            </div>

            {multi && indice === 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontWeight: 700, fontSize: '14px' }}>
                <span aria-label={`Monto en ${nombreMedio(fila.medio)}`}>S/ {montoPrimera.toFixed(2)}</span>
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--cp-soft)' }}>lo que falta</span>
              </div>
            )}

            {multi && indice > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    width: '96px',
                    minHeight: ALTO_TOQUE,
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => quitarFila(indice)}
                  aria-label={`Quitar ${nombreMedio(fila.medio)}`}
                  style={{
                    minHeight: ALTO_TOQUE,
                    padding: '0 10px',
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
              </div>
            )}
          </div>
        </div>
      ))}

      {vista.length < MEDIOS_PLAN.length && total > 0 && (
        <button
          type="button"
          onClick={agregarMedio}
          style={{
            minHeight: ALTO_TOQUE,
            borderRadius: '10px',
            border: '1.5px dashed var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Agregar otro medio de pago
        </button>
      )}

      {multi && total > 0 && (
        <div aria-label="Resumen del pago" style={{ fontSize: '13px', fontWeight: 700 }}>
          {resumen}
        </div>
      )}

      {total > 0 && multi && (
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
            ¿Con cuánto paga?{' '}
            <span style={{ fontWeight: 400, fontSize: '12px' }}>
              {pagaConObligatorio ? '(obligatorio para calcular el vuelto)' : '(opcional)'}
            </span>
          </label>
          <input
            id="plan-paga-con"
            type="number"
            step="0.50"
            min="0"
            value={pagaCon}
            onChange={(e) => onPagaCon(e.target.value)}
            placeholder={montoEf > 0 ? `Mínimo S/ ${montoEf.toFixed(2)}` : pagaConObligatorio ? 'Obligatorio' : 'Opcional'}
            aria-required={pagaConObligatorio}
            aria-invalid={pagaConInvalido}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: ALTO_TOQUE,
              borderRadius: '10px',
              border: `1.5px solid ${pagaConInvalido ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
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
