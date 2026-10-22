import { useEsMovil } from './useEsMovil';

/** Página «Novedades» (mockup Main ▸ NOVEDADES). Las novedades las publica el administrativo (FT-CON-03, aún no construido). */
export function PaginaNovedades({ onVerCarta }: { onVerCarta: () => void }) {
  const movil = useEsMovil();
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', maxWidth: 1200, margin: '0 auto', padding: movil ? '12px 16px 40px' : '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: movil ? 12 : 20 }}>
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(155deg, var(--cp-navy) 55%, #3b5a3f)', color: 'var(--cp-cream)', borderRadius: movil ? 14 : 20, padding: movil ? 18 : 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span aria-hidden="true" style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.16 }} />
        <span style={{ position: 'relative', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em', color: 'var(--cp-orange)' }}>NOVEDADES</span>
        <span style={{ position: 'relative', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 22 : 34, lineHeight: movil ? '28px' : '42px' }}>Lo nuevo en Caprichos</span>
        <span style={{ position: 'relative', fontSize: movil ? 14 : 16, lineHeight: '22px', maxWidth: 720 }}>Promociones, productos nuevos y avisos del local.</span>
      </div>
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--cp-soft)' }}>
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>Aún no hay novedades</div>
        <div style={{ marginTop: 4 }}>Vuelve pronto o mira la carta.</div>
        <button onClick={onVerCarta} style={{ marginTop: 16, minHeight: 44, padding: '0 20px', border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: '#fff', fontWeight: 800 }}>
          Ver la carta
        </button>
      </div>
    </div>
  );
}
