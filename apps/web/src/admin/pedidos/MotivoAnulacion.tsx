/** «Motivo: …» de un pedido anulado (la anulación automática por vencimiento dice «Sin pago en línea en 15 minutos»). */
export function MotivoAnulacion({ pedido }: { pedido: { estado?: string | null; motivo_anulacion?: string | null } }) {
  const anulado = String(pedido.estado || '').toUpperCase() === 'ANULADO';
  const motivo = pedido.motivo_anulacion?.trim();
  if (!anulado || !motivo) return null;
  const texto = `Motivo: ${motivo}`;
  return (
    <span
      data-testid="motivo-anulacion"
      title={texto}
      style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}
    >
      {texto}
    </span>
  );
}
