/**
 * Número del día del pedido en cocina («#7 del día»). Es referencial: el código CP-xxxx sigue siendo el
 * identificador. Un pedido sin número (anterior a la función, o que nunca llegó a cocina) muestra «—».
 */
export function InsigniaNumeroDia({ numero }: { numero?: number | null }) {
  const tiene = numero != null;
  return (
    <span
      title={tiene ? 'Número del día en cocina (referencial)' : 'Sin número del día'}
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 800,
        borderRadius: 9999,
        padding: '2px 10px',
        background: tiene ? 'var(--cp-sand, #F4EBDD)' : 'transparent',
        border: '1px solid var(--cp-line, #E5DCCB)',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      {tiene ? `#${numero} del día` : '—'}
    </span>
  );
}
