import { useEsMovil } from '../useEsMovil';

export interface PromoCarta {
  tag: string;
  title: string;
  sub: string;
  price: string;
  old?: string;
  badge?: string;
  theme?: string;
  photo?: string;
  target?: string;
}

interface Props {
  promos: PromoCarta[];
  /** Foto del producto al que apunta la promoción (si el administrador no subió una propia) */
  fotoDe: (nombre: string) => string | null;
  onAbrir: (nombre: string) => void;
}

/** Las dos tarjetas grandes de promoción de la parte alta de la carta (mockup Main ▸ promociones). */
export function PromosCarta({ promos, fotoDe, onAbrir }: Props) {
  const movil = useEsMovil();
  if (promos.length === 0) return null;
  return (
    <div style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '20px 16px 0' : '32px 24px 0', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {promos.map((p, i) => {
        const naranja = p.theme === 'naranja';
        const bg = naranja ? 'var(--cp-orange)' : 'var(--cp-navy)';
        const fg = naranja ? 'var(--cp-navy)' : 'var(--cp-cream)';
        const acc = naranja ? 'var(--cp-navy)' : 'var(--cp-orange)';
        const foto = p.photo || fotoDe(p.target || p.title);
        return (
          <button
            key={i}
            onClick={() => onAbrir(p.target || p.title)}
            style={{ flex: '1 1 340px', minWidth: 0, border: 0, padding: 0, borderRadius: 20, background: bg, color: fg, overflow: 'hidden', display: 'flex', alignItems: 'stretch', textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ flex: 1, padding: movil ? 16 : 24, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', color: acc }}>{p.tag}</span>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 20 : 26, lineHeight: movil ? '24px' : '30px', overflowWrap: 'anywhere' }}>{p.title}</span>
              <span style={{ fontSize: 14 }}>{p.sub}</span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 26 : 32, color: acc }}>{p.price}</span>
                {p.old && <span style={{ fontSize: 16, textDecoration: 'line-through', opacity: 0.7 }}>{p.old}</span>}
                {p.badge && <span style={{ fontSize: 12, fontWeight: 700, background: acc, color: bg, borderRadius: 9999, padding: '2px 10px' }}>{p.badge}</span>}
              </span>
            </span>
            {foto && <img src={foto} alt={p.title} style={{ width: movil ? 120 : 200, objectFit: 'cover', flex: 'none' }} />}
          </button>
        );
      })}
    </div>
  );
}
