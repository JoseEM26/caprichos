import { memo, useEffect, useRef } from 'react';
import type { CategoriaCarta, ProductoCarta } from '../../../carta/tipos';
import { infoStockDe } from '../../../carta/stock';

/** Tira de categorías táctil: el chip activo se centra solo al elegirse. */
export const BarraCategorias = memo(function BarraCategorias({
  categorias,
  activaId,
  alElegir,
}: {
  categorias: CategoriaCarta[];
  activaId: string;
  alElegir: (id: string) => void;
}) {
  const tira = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = tira.current;
    const el = t?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!t || !el || typeof t.scrollTo !== 'function') return;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    t.scrollTo({
      left: el.offsetLeft - (t.clientWidth - el.offsetWidth) / 2,
      behavior: reducido ? 'auto' : 'smooth',
    });
  }, [activaId]);

  const chip = (id: string, nombre: string) => (
    <button
      key={id}
      type="button"
      className={activaId === id ? 'np-chip-cat np-chip-cat--activa' : 'np-chip-cat'}
      aria-pressed={activaId === id}
      onClick={() => alElegir(id)}
    >
      {nombre}
    </button>
  );

  return (
    <div className="np-categorias-wrap">
      <div className="np-categorias" ref={tira}>
        {chip('todas', 'Todos')}
        {categorias.map((c) => chip(c.id, c.nombre))}
      </div>
    </div>
  );
});

/** Tarjeta de producto: memoizada para no repintar toda la carta al buscar o cambiar de categoría. */
export const TarjetaProducto = memo(function TarjetaProducto({
  producto: p,
  conImagenes,
  alElegir,
}: {
  producto: ProductoCarta;
  conImagenes: boolean;
  alElegir: (p: ProductoCarta) => void;
}) {
  const sinStock = infoStockDe(p).quedan === 0;
  return (
    <button type="button" onClick={() => alElegir(p)} className="np-producto">
      {conImagenes && (
        <span className="np-producto-foto">
          {p.fotoUrl ? (
            <img src={p.fotoUrl} alt={p.nombre} width={56} height={56} loading="lazy" decoding="async" />
          ) : (
            <span className="np-producto-iniciales">
              {p.nombre
                .split(' ')
                .filter((w) => w.length > 2)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('')}
            </span>
          )}
        </span>
      )}
      <span className="np-producto-texto">
        <span className="np-producto-nombre">{p.nombre}</span>
        <span className="np-producto-precio">
          {(p.tamanos || []).length > 0 ? 'Desde ' : ''}S/ {Number(p.precio || 0).toFixed(2)}
        </span>
        {sinStock && (
          <span data-testid="tarjeta-sin-stock" style={{ color: 'var(--cp-rust)', fontWeight: 800, fontSize: '12px' }}>
            Sin stock hoy
          </span>
        )}
      </span>
    </button>
  );
});
