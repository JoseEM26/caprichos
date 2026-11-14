import { DIAS_MAX_PROGRAMADO, errorParaCuando, hoyLima, sumarDias, type ParaCuando } from './paraCuando';

export type MedioAdelanto = 'EFECTIVO' | 'TARJETA';

export interface SelectorParaCuandoProps {
  valor: ParaCuando;
  onChange: (v: ParaCuando) => void;
  /** Adelanto de hoy (opcional): monto en texto y medio. Solo se muestra al programar. */
  adelanto: string;
  onAdelanto: (v: string) => void;
  medioAdelanto: MedioAdelanto;
  onMedioAdelanto: (m: MedioAdelanto) => void;
  mostrarErrores?: boolean;
}

/**
 * «¿Para cuándo?»: Ahora (sale a cocina como siempre), Mañana u otra fecha con hora. Un pedido programado no entra a
 * cocina ni a reparto hoy; pasa solo el día pactado. Solo Caja y mozo lo ven (la carta virtual y el bot no).
 */
export function SelectorParaCuando({ valor, onChange, adelanto, onAdelanto, medioAdelanto, onMedioAdelanto, mostrarErrores }: SelectorParaCuandoProps) {
  const hoy = hoyLima();
  const error = mostrarErrores ? errorParaCuando(valor) : null;
  const opciones: { id: ParaCuando['modo']; n: string }[] = [
    { id: 'AHORA', n: 'Ahora' },
    { id: 'MANANA', n: 'Mañana' },
    { id: 'OTRA', n: 'Otra fecha' },
  ];
  return (
    <fieldset className="np2-cuando" data-testid="para-cuando">
      <legend>¿Para cuándo?</legend>
      <div role="radiogroup" aria-label="Para cuándo" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valor.modo === o.id}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid var(--cp-navy, #0B2C3E)',
              background: valor.modo === o.id ? 'var(--cp-navy, #0B2C3E)' : 'var(--cp-white, #fff)',
              color: valor.modo === o.id ? '#fff' : 'var(--cp-navy, #0B2C3E)',
            }}
            onClick={() => onChange({ ...valor, modo: o.id, ...(o.id === 'AHORA' ? { hora: '' } : {}) })}
          >
            {o.n}
          </button>
        ))}
      </div>
      {valor.modo !== 'AHORA' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          {valor.modo === 'OTRA' && (
            <label>
              Fecha{' '}
              <input
                type="date"
                aria-label="Fecha del pedido"
                value={valor.fecha}
                min={hoy}
                max={sumarDias(hoy, DIAS_MAX_PROGRAMADO)}
                onChange={(e) => onChange({ ...valor, fecha: e.target.value })}
              />
            </label>
          )}
          <label>
            Hora{' '}
            <input type="time" aria-label="Hora del pedido" value={valor.hora} onChange={(e) => onChange({ ...valor, hora: e.target.value })} />
          </label>
        </div>
      )}
      {valor.modo !== 'AHORA' && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13 }}>
            No entra a cocina ni a reparto hoy: pasa solo el día pactado. Si pagan todo hoy, cóbralo en Caja; si dejan un adelanto, entra a la caja de hoy y el resto el día que paguen.
          </p>
          <label>
            Adelanto hoy (opcional) S/{' '}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              aria-label="Adelanto de hoy"
              value={adelanto}
              onChange={(e) => onAdelanto(e.target.value)}
              style={{ width: 90 }}
            />
          </label>{' '}
          <select aria-label="Medio del adelanto" value={medioAdelanto} onChange={(e) => onMedioAdelanto(e.target.value as MedioAdelanto)}>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
          </select>
        </div>
      )}
      {error && (
        <div role="alert" className="np2-motivo">
          {error}
        </div>
      )}
    </fieldset>
  );
}
