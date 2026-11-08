/** Cómo paga el trabajador su pedido del personal: a su crédito (por defecto) o «Pagar ahora» con medio. */
export type ModoPagoPersonal = 'credito' | 'ahora';
export const MEDIOS_PAGO_PERSONAL = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] as const;
const ETIQUETA_MEDIO: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

/** Error de «Con cuánto paga» del personal en efectivo (null si no aplica o está bien). */
export function errorPagaConPersonal(modo: ModoPagoPersonal, medio: string, total: number, pagaCon: string): string | null {
  if (modo !== 'ahora' || medio !== 'EFECTIVO' || total <= 0) return null;
  const n = Number(pagaCon);
  if (pagaCon === '' || isNaN(n) || n < total) return `Indica con cuánto paga: debe ser S/ ${total.toFixed(2)} o más`;
  return null;
}

/** Texto del botón final según cómo paga el trabajador. */
export function textoPagoPersonal(modo: ModoPagoPersonal, medio: string): string {
  return modo === 'credito' ? 'se carga a su crédito' : `paga ahora en ${ETIQUETA_MEDIO[medio]?.toLowerCase() ?? medio.toLowerCase()}`;
}

interface Props {
  modo: ModoPagoPersonal;
  onModo: (m: ModoPagoPersonal) => void;
  medio: string;
  onMedio: (m: string) => void;
  total: number;
  pagaCon: string;
  onPagaCon: (v: string) => void;
  /** Puede cobrar en el momento (creditos/cobrar_ahora); si no, solo existe «a su crédito» */
  puedeCobrarAhora: boolean;
  error: string | null;
  mostrarError: boolean;
}

const tarjeta = (activa: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: 140,
  minHeight: 56,
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 10,
  cursor: 'pointer',
  border: `2px solid ${activa ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
  background: activa ? 'var(--cp-cream, #fff7ec)' : 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontSize: 12,
});

export function PagoPersonalBloque({ modo, onModo, medio, onMedio, total, pagaCon, onPagaCon, puedeCobrarAhora, error, mostrarError }: Props) {
  const vuelto = Number(pagaCon) - total;
  return (
    <div id="np-pago-personal" data-testid="pago-personal" role="group" aria-label="¿Cómo lo paga el trabajador?" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>¿Cómo lo paga el trabajador?</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" aria-pressed={modo === 'credito'} onClick={() => onModo('credito')} style={tarjeta(modo === 'credito')}>
          <b>🧾 Cargar a su crédito</b>
          <div style={{ color: 'var(--cp-soft)' }}>Se descuenta después en su planilla (con el descuento de personal)</div>
        </button>
        {puedeCobrarAhora && (
          <button type="button" aria-pressed={modo === 'ahora'} onClick={() => onModo('ahora')} style={tarjeta(modo === 'ahora')}>
            <b>💵 Pagar ahora</b>
            <div style={{ color: 'var(--cp-soft)' }}>Se le cobra en este momento y queda anotado quién cobró</div>
          </button>
        )}
      </div>
      {modo === 'ahora' && puedeCobrarAhora && (
        <>
          <div role="radiogroup" aria-label="Medio de pago" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEDIOS_PAGO_PERSONAL.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={medio === m}
                onClick={() => onMedio(m)}
                style={{ ...tarjeta(medio === m), flex: '0 0 auto', minWidth: 80, minHeight: 44, textAlign: 'center', fontWeight: 700 }}
              >
                {ETIQUETA_MEDIO[m]}
              </button>
            ))}
          </div>
          {medio === 'EFECTIVO' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="personal-paga-con" style={{ fontSize: 12, fontWeight: 700 }}>¿Con cuánto paga? *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id="personal-paga-con"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={pagaCon}
                  onChange={(e) => onPagaCon(e.target.value)}
                  aria-invalid={mostrarError && error ? true : undefined}
                  style={{ minHeight: 44, width: 120, borderRadius: 8, border: '1.5px solid var(--cp-line)', padding: '0 8px', fontSize: 14 }}
                />
                <button type="button" onClick={() => onPagaCon(total.toFixed(2))} style={{ minHeight: 44, borderRadius: 8, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', padding: '0 10px', fontWeight: 700, cursor: 'pointer' }}>
                  Pago exacto
                </button>
              </div>
              {pagaCon !== '' && !error && (
                <span data-testid="personal-vuelto" style={{ fontSize: 12, fontWeight: 700 }}>Vuelto: S/ {Math.max(0, vuelto).toFixed(2)}</span>
              )}
            </div>
          )}
          {mostrarError && error && (
            <span role="alert" style={{ fontSize: 12, color: 'var(--cp-rust)', fontWeight: 700 }}>{error}</span>
          )}
        </>
      )}
    </div>
  );
}
