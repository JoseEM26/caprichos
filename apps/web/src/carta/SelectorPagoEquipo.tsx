export type PagoEquipo = 'CONTADO' | 'CREDITO';

interface Props {
  valor: PagoEquipo;
  alCambiar: (v: PagoEquipo) => void;
  /** Falso = la cuenta es del equipo pero no está vinculada a su usuario: el crédito no se ofrece */
  puedeCredito: boolean;
  /** El crédito no aplica a pedidos con delivery */
  esDelivery?: boolean;
}

const tarjeta = (activa: boolean, deshabilitada: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minHeight: '44px',
  padding: '10px 12px',
  borderRadius: '12px',
  border: activa ? '2px solid var(--cp-primary, #b05a6b)' : '1px solid var(--cp-line)',
  backgroundColor: 'var(--cp-white)',
  cursor: deshabilitada ? 'not-allowed' : 'pointer',
  opacity: deshabilitada ? 0.6 : 1,
});

/** Solo para el equipo con sesión: pagar al contado o cargar el pedido a su crédito del personal. */
export function SelectorPagoEquipo({ valor, alCambiar, puedeCredito: puedeCreditoCuenta, esDelivery = false }: Props) {
  const puedeCredito = puedeCreditoCuenta && !esDelivery;
  return (
    <fieldset
      data-testid="selector-pago-equipo"
      style={{ border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--cp-white)' }}
    >
      <legend style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: '14px', padding: '0 4px' }}>¿Cómo quieres pagar?</legend>
      <label style={tarjeta(valor === 'CONTADO', false)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
          <input type="radio" name="pago-equipo" checked={valor === 'CONTADO'} onChange={() => alCambiar('CONTADO')} />
          Pagar al contado
        </span>
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Pagas todo ahora, como cualquier cliente.</span>
      </label>
      <label style={tarjeta(valor === 'CREDITO', !puedeCredito)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}>
          <input
            type="radio"
            name="pago-equipo"
            checked={valor === 'CREDITO'}
            disabled={!puedeCredito}
            onChange={() => alCambiar('CREDITO')}
          />
          Cargar a mi crédito del personal
        </span>
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
          {esDelivery
            ? 'El crédito del personal no aplica a pedidos con delivery; elige pagar al contado.'
            : puedeCredito
              ? 'Se descuenta de tu planilla.'
              : 'No disponible: pide al administrador que vincule tu cuenta con tu usuario.'}
        </span>
      </label>
    </fieldset>
  );
}
