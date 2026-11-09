import type { OfertaItem } from './ofertasApi';

/** Piezas del combo que lo bloquean y por qué («Agotado hasta 15:40», «Stock 0»). Solo el panel del dueño lo recibe. */
export function PiezasBloqueadas({ oferta }: { oferta?: Pick<OfertaItem, 'piezasBloqueadas'> | null }) {
  const piezas = oferta?.piezasBloqueadas ?? [];
  if (piezas.length === 0) return null;
  return (
    <div data-testid="piezas-bloqueadas" role="status" style={{ fontSize: '12px', color: 'var(--cp-navy)', border: '1px solid var(--cp-orange)', borderRadius: 8, padding: '8px 10px', margin: '6px 0' }}>
      <strong>Este combo está agotado por estas piezas:</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {piezas.map((p) => (
          <li key={p.productoId}>
            {p.nombre} · {p.motivo}{' '}
            <a href="/admin/productos" target="_blank" rel="noreferrer" style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>Ver en Productos</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
