/** Aviso de «Comer en el local»: sin mesa ni croquis, el cliente espera y se le llama por su nombre. */
export function AvisoComerEnLocal({ nombre }: { nombre: string }) {
  const quien = nombre.trim();
  return (
    <div
      role="note"
      data-testid="aviso-comer-local"
      style={{
        marginTop: '10px',
        background: 'var(--cp-sand)',
        border: '2px solid var(--cp-orange)',
        borderRadius: '12px',
        padding: '12px 14px',
        color: 'var(--cp-navy)',
        fontSize: '14px',
        lineHeight: '20px',
        fontWeight: 700,
      }}
    >
      <span aria-hidden="true">🍽️ </span>
      Te atenderemos por tu nombre{quien ? <>: <strong style={{ fontSize: '17px' }}>{quien}</strong></> : ''}. Te llamaremos cuando tu pedido esté listo. Estás pidiendo para comer en el local.
    </div>
  );
}
