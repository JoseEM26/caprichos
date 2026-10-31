const MOTIVOS_RAPIDOS = [
  'El cliente envió el voucher correcto por WhatsApp',
  'La foto anterior estaba ilegible o cortada',
  'El monto o el medio no era el correcto',
  'Se había subido al pedido equivocado',
];

export const MOTIVO_MINIMO = 5;

interface Props {
  id: string;
  valor: string;
  alCambiar: (v: string) => void;
  /** Texto de la pregunta sobre el campo. */
  pregunta?: string;
}

/** Motivo del cambio de voucher: se pregunta UNA vez, con motivos rápidos que llenan el campo. */
export function MotivoCambioVoucher({ id, valor, alCambiar, pregunta = 'Motivo del cambio: ¿por qué se cambia el voucher?' }: Props) {
  const largo = valor.trim().length;
  return (
    <div data-testid="motivo-cambio" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
        {pregunta}
      </label>
      <div role="group" aria-label="Motivos rápidos" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MOTIVOS_RAPIDOS.map((m) => {
          const activo = valor === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={activo}
              onClick={() => alCambiar(m)}
              style={{
                minHeight: 36,
                padding: '4px 10px',
                borderRadius: 999,
                border: `1.5px solid ${activo ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
                background: activo ? 'var(--cp-cream, #FFF4E6)' : 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
      <textarea
        id={id}
        rows={2}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder="O escribe el motivo con tus palabras"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 56, border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
      />
      <div style={{ fontSize: 12, color: largo >= MOTIVO_MINIMO ? 'var(--cp-green, #2F7A45)' : 'var(--cp-soft, #2C4C5D)' }}>
        {largo >= MOTIVO_MINIMO ? 'Listo. El voucher anterior no se borra: queda en el historial.' : `Faltan ${MOTIVO_MINIMO - largo} caracteres. El voucher anterior no se borra: queda en el historial.`}
      </div>
    </div>
  );
}
