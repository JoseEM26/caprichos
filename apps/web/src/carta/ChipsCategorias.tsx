import { CategoriaCarta } from './tipos';

interface ChipsCategoriasProps {
  categorias: CategoriaCarta[];
  categoriaActivaId: string | null;
  onSeleccionarCategoria: (id: string) => void;
}

export function ChipsCategorias({
  categorias,
  categoriaActivaId,
  onSeleccionarCategoria,
}: ChipsCategoriasProps) {
  if (categorias.length === 0) return null;

  return (
    <nav
      aria-label="Categorías de la carta"
      style={{
        position: 'sticky',
        top: '69px',
        zIndex: 15,
        backgroundColor: 'var(--cp-cream)',
        borderBottom: '1px solid var(--cp-line)',
        padding: '8px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {categorias.map((cat) => {
          const estaActiva = categoriaActivaId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSeleccionarCategoria(cat.id)}
              style={{
                flex: 'none',
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: estaActiva ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: estaActiva ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                transition: 'background-color 0.2s, color 0.2s',
              }}
            >
              {cat.nombre}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
