import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';

export interface BannerCarta {
  activo?: boolean;
  tag?: string;
  title?: string;
  sub?: string;
}

interface PortadaCartaProps {
  datosLocal: DatosLocalCarta | null;
  estadoLocal: EstadoLocalCarta | null;
  /** Foto del producto destacado del mes */
  fotoDestacada: string | null;
  banner?: BannerCarta | null;
  onPedir: () => void;
  onVerCarta: () => void;
}

/** Portada de la carta: banner del mes administrable y datos útiles (mockup Main ▸ PORTADA). */
export function PortadaCarta({ datosLocal, estadoLocal, fotoDestacada, banner, onPedir, onVerCarta }: PortadaCartaProps) {
  const movil = useEsMovil();

  const mostrarBanner = !!banner && banner.activo !== false && !!banner.title;
  const tagBanner = banner?.tag ?? '';
  const titleBanner = banner?.title ?? '';
  const subBanner = banner?.sub ?? '';

  const medios = Object.entries(datosLocal?.mediosPago ?? {})
    .filter(([, m]) => m.activo)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const entrega = estadoLocal?.tiempoPrometidoMin
    ? `${estadoLocal.altaDemandaMin ? 'Alta demanda: entrega' : 'Entrega'} en unos ${estadoLocal.tiempoPrometidoMin + (estadoLocal.altaDemandaMin || 0)} min`
    : null;
  const datos = [
    estadoLocal && { t: estadoLocal.texto, color: estadoLocal.abierta ? '#2F9E57' : 'var(--cp-rust)' },
    datosLocal?.envioGratisDesde != null && { t: `Delivery gratis desde S/ ${datosLocal.envioGratisDesde.toFixed(2)}`, color: 'var(--cp-orange)' },
    entrega && { t: entrega, color: estadoLocal?.altaDemandaMin ? 'var(--cp-rust)' : 'var(--cp-orange)' },
    medios.length > 0 && { t: medios.join(' · '), color: 'var(--cp-orange)' },
  ].filter(Boolean) as { t: string; color: string }[];

  return (
    <div style={{ width: '100%', maxWidth: 1200, boxSizing: 'border-box', margin: '0 auto', padding: movil ? '12px 16px 0' : '24px 24px 0' }}>
      {mostrarBanner && (
        <div
          role="region"
          aria-label="Caprichos del mes"
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(155deg, var(--cp-navy) 55%, #3b5a3f)',
            color: 'var(--cp-cream)',
            borderRadius: movil ? 22 : 28,
            padding: movil ? '18px 16px' : '36px 40px',
          }}
        >
          <span aria-hidden="true" style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.16 }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: -40, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.1 }} />
          <div style={{ position: 'relative', display: 'flex', gap: movil ? 12 : 32, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: movil ? 8 : 12 }}>
              <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 10 : 12, letterSpacing: '0.1em', color: 'var(--cp-navy)', background: 'var(--cp-orange)', borderRadius: 9999, padding: '4px 10px' }}>
                {tagBanner}
              </span>
              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 24 : 44, lineHeight: movil ? '28px' : '50px', overflowWrap: 'anywhere' }}>{titleBanner}</span>
              <span style={{ fontSize: movil ? 12 : 14, lineHeight: movil ? '16px' : '20px', opacity: 0.9 }}>{subBanner}</span>
            </div>
            <span
              style={{
                flex: 'none',
                width: movil ? 104 : 230,
                height: movil ? 104 : 230,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid var(--cp-orange)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
                boxSizing: 'border-box',
                display: 'block',
              }}
            >
              {fotoDestacada && (
                <img
                  src={fotoDestacada}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </span>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: movil ? 16 : 24 }}>
            <button onClick={onPedir} style={{ flex: '1 1 140px', maxWidth: movil ? 'none' : 260, minHeight: movil ? 48 : 54, border: 0, borderRadius: 14, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>
              Pedir ahora
            </button>
            <button onClick={onVerCarta} style={{ flex: '1 1 140px', maxWidth: movil ? 'none' : 260, minHeight: movil ? 48 : 54, border: '1.5px solid var(--cp-cream)', borderRadius: 14, background: 'transparent', color: 'var(--cp-cream)', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>
              Ver la carta
            </button>
          </div>
        </div>
      )}
      {datos.length > 0 && (
        <div aria-label="Datos útiles" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, scrollbarWidth: 'none' }}>
          {datos.map((d) => (
            <span
              key={d.t}
              style={{ flex: 'none', minHeight: 36, padding: '0 12px', boxSizing: 'border-box', borderRadius: 9999, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700 }}
            >
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: d.color }} />
              {d.t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
