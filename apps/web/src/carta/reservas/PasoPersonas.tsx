import { TACTIL_RESERVA, estiloChip, etiquetaReserva, filaChips } from './estilosReserva';

interface PasoPersonasProps {
  personas: number;
  personasMax: number;
  onCambio: (personas: number) => void;
}

const RAPIDOS = [1, 2, 3, 4, 5];
const DESDE_SEIS = 6;

const botonRedondo = {
  flex: 'none',
  width: TACTIL_RESERVA,
  height: TACTIL_RESERVA,
  borderRadius: TACTIL_RESERVA / 2,
  border: '1.5px solid var(--cp-navy)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 22,
  lineHeight: '22px',
  padding: 0,
  cursor: 'pointer',
} as const;

/** Paso 1: cuántas personas. Botones − / + y chips rápidos (1 a 5, y 6 o más). */
export function PasoPersonas({ personas, personasMax, onCambio }: PasoPersonasProps) {
  const tope = Math.max(1, personasMax);
  const ajustar = (n: number) => onCambio(Math.min(tope, Math.max(1, n)));

  return (
    <section aria-labelledby="reserva-paso-personas">
      <h3 id="reserva-paso-personas" style={{ ...etiquetaReserva, fontSize: 16, margin: '0 0 12px' }}>
        ¿Para cuántas personas?
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, margin: '8px 0 18px' }}>
        <button type="button" aria-label="Quitar una persona" onClick={() => ajustar(personas - 1)} disabled={personas <= 1} style={{ ...botonRedondo, opacity: personas <= 1 ? 0.4 : 1 }}>
          −
        </button>
        <output aria-live="polite" style={{ minWidth: 120, textAlign: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 28, color: 'var(--cp-navy)' }}>
          {personas} {personas === 1 ? 'persona' : 'personas'}
        </output>
        <button type="button" aria-label="Agregar una persona" onClick={() => ajustar(personas + 1)} disabled={personas >= tope} style={{ ...botonRedondo, opacity: personas >= tope ? 0.4 : 1 }}>
          +
        </button>
      </div>

      <div style={filaChips} role="group" aria-label="Número rápido de personas">
        {RAPIDOS.map((n) => {
          const bloqueado = n > tope;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={personas === n}
              disabled={bloqueado}
              onClick={() => ajustar(n)}
              style={estiloChip(personas === n, bloqueado)}
            >
              {n}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={personas >= DESDE_SEIS}
          disabled={DESDE_SEIS > tope}
          onClick={() => ajustar(Math.max(personas, DESDE_SEIS))}
          style={estiloChip(personas >= DESDE_SEIS, DESDE_SEIS > tope)}
        >
          6+
        </button>
      </div>

      {personasMax < DESDE_SEIS && (
        <p style={{ fontSize: 13, color: 'var(--cp-soft)', margin: '12px 0 0' }}>
          Por la carta puedes reservar para hasta {tope} {tope === 1 ? 'persona' : 'personas'}. Para un grupo más grande, escríbenos o llámanos.
        </p>
      )}
    </section>
  );
}
