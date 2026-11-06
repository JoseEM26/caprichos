/** Insignia «Dirección editada»: el punto del pedido cambió después de tomarlo (ver historial de ubicación). */
export function InsigniaDireccionEditada({ titulo }: { titulo?: string }) {
  return (
    <span
      title={titulo ?? 'La dirección se editó: revisa el historial de ubicación'}
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 9999,
        padding: '2px 8px',
        background: 'rgb(255, 241, 201)',
        border: '1px solid var(--cp-navy, #0B2C3E)',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      Dirección editada
    </span>
  );
}
