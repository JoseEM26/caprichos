import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';
import { DISPOSICION_DEFECTO, medidasBanner } from './disposicion';
import type { IdItemFranja, TamanoBanner } from './disposicion';
import { TextoEd, useEdicion } from './edicion';

export interface BannerCarta {
  activo?: boolean;
  tag?: string;
  title?: string;
  sub?: string;
  target?: string;
  /** Foto propia del banner; si falta se usa la del producto destacado. */
  foto?: string;
}

interface AjusteBannerProps {
  /** Tamaño del banner en PC y en celular (se elige por el ancho real o por la vista previa). */
  tamanoPc?: TamanoBanner;
  tamanoCelular?: TamanoBanner;
  ajusteFoto?: 'cubrir' | 'contener';
  focoFoto?: 'arriba' | 'centro' | 'abajo';
}

interface BannerMesProps extends AjusteBannerProps {
  /** Foto del producto destacado del mes */
  fotoDestacada: string | null;
  banner?: BannerCarta | null;
  onPedir: () => void;
  onVerCarta: () => void;
}

const POSICION_FOTO = { arriba: 'center top', centro: 'center center', abajo: 'center bottom' } as const;

/** Banner «Caprichos del mes» (administrable). */
export function BannerMesCarta({
  fotoDestacada,
  banner,
  onPedir,
  onVerCarta,
  tamanoPc = DISPOSICION_DEFECTO.banner.tamanoPc,
  tamanoCelular = DISPOSICION_DEFECTO.banner.tamanoCelular,
  ajusteFoto = DISPOSICION_DEFECTO.banner.ajusteFoto,
  focoFoto = DISPOSICION_DEFECTO.banner.focoFoto,
}: BannerMesProps) {
  const movil = useEsMovil();
  const ed = useEdicion();
  const medidas = medidasBanner(movil ? tamanoCelular : tamanoPc, movil);

  // En edición el banner oculto se sigue viendo (la barra lo marca «Oculta»)
  const mostrarBanner = !!ed || !banner || banner.activo !== false;
  const tagBanner = banner?.tag || 'NOVEDAD DEL MES';
  const titleBanner = banner?.title || 'Frappe Maracuyá Tropical';
  const subBanner = banner?.sub || 'Con pulpa natural de maracuyá y crema batida.';
  if (!mostrarBanner) return null;

  return (
    <div style={{ width: '100%', maxWidth: 1200, boxSizing: 'border-box', margin: '0 auto', padding: movil ? '12px 16px 0' : '24px 24px 0' }}>
      <div
        role="region"
        aria-label="Caprichos del mes"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(155deg, var(--cp-navy) 55%, color-mix(in srgb, var(--cp-navy) 65%, var(--cp-orange)))',
          color: 'var(--cp-cream)',
          borderRadius: movil ? 22 : 28,
          padding: medidas.padding,
        }}
      >
        <span aria-hidden="true" style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.16 }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: -40, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.1 }} />
        <div style={{ position: 'relative', display: 'flex', gap: movil ? 12 : 32, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: movil ? 8 : 12 }}>
            <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 10 : 12, letterSpacing: '0.1em', color: 'var(--cp-navy)', background: 'var(--cp-orange)', borderRadius: 9999, padding: '4px 10px' }}>
              <TextoEd clave="banner.tag" valor={tagBanner} ayuda="Etiqueta del banner" />
            </span>
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: medidas.titulo, lineHeight: medidas.tituloLinea, overflowWrap: 'anywhere' }}><TextoEd clave="banner.title" valor={titleBanner} ayuda="Título del banner" /></span>
            <span style={{ fontSize: movil ? 12 : 14, lineHeight: movil ? '16px' : '20px', opacity: 0.9 }}><TextoEd clave="banner.sub" valor={subBanner} ayuda="Texto del banner" /></span>
          </div>
          <span
            {...(ed
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': 'Cambiar producto y foto del banner',
                  'data-edicion': 'accion',
                  onClick: () => ed.accion('banner.producto'),
                  onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && ed.accion('banner.producto'),
                }
              : {})}
            style={{
              cursor: ed ? 'pointer' : undefined,
              flex: 'none',
              width: medidas.foto,
              height: medidas.foto,
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
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: ajusteFoto === 'contener' ? 'contain' : 'cover',
                  objectPosition: POSICION_FOTO[focoFoto],
                  display: 'block',
                }}
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
    </div>
  );
}

interface FranjaDatosProps {
  datosLocal: DatosLocalCarta | null;
  estadoLocal: EstadoLocalCarta | null;
  /** Orden y visibilidad de cada dato de la franja. */
  items?: { id: IdItemFranja; visible: boolean }[];
}

/** Franja de datos útiles: abierto, delivery gratis, tiempo de entrega y medios de pago. */
export function FranjaDatosCarta({ datosLocal, estadoLocal, items = DISPOSICION_DEFECTO.franja.items }: FranjaDatosProps) {
  const movil = useEsMovil();

  const mediosActivos = Object.entries(datosLocal?.mediosPago ?? {})
    .filter(([k, m]) => m.activo && k.toLowerCase() !== 'efectivo')
    .map(([k]) => (k.toLowerCase() === 'pos' ? 'Tarjeta' : k.charAt(0).toUpperCase() + k.slice(1)));
  const textoMedios = mediosActivos.length > 0 ? mediosActivos.join(' · ') : 'Yape · Plin · Tarjeta';

  const minProm = estadoLocal?.tiempoPrometidoMin ?? 35;
  const minExtra = estadoLocal?.altaDemandaMin ?? 0;
  const entrega = minExtra > 0
    ? `Alta demanda: entrega en unos ${minProm + minExtra} min`
    : `Entrega en unos ${minProm} min`;
  const envioGratis = datosLocal?.envioGratisDesde ?? 70;
  const montoEnvioGratis = Number.isInteger(envioGratis) ? String(envioGratis) : envioGratis.toFixed(2);

  const porId: Record<IdItemFranja, { t: string; color: string }> = {
    estado: estadoLocal
      ? { t: estadoLocal.texto, color: estadoLocal.abierta ? '#2F9E57' : 'var(--cp-rust)' }
      : { t: 'Abierto hoy hasta las 11:00 p. m.', color: '#2F9E57' },
    delivery: { t: `Delivery gratis por compras de más de s/ ${montoEnvioGratis}`, color: 'var(--cp-orange)' },
    entrega: { t: entrega, color: minExtra > 0 ? 'var(--cp-rust)' : 'var(--cp-orange)' },
    medios: { t: textoMedios, color: 'var(--cp-orange)' },
  };
  const datos = items.filter((i) => i.visible).map((i) => porId[i.id]);

  if (datos.length === 0) return null;
  return (
    <div style={{ width: '100%', maxWidth: 1200, boxSizing: 'border-box', margin: '0 auto', padding: movil ? '12px 16px 0' : '12px 24px 0' }}>
      <div aria-label="Datos útiles" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
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
    </div>
  );
}

interface PortadaCartaProps extends AjusteBannerProps {
  datosLocal: DatosLocalCarta | null;
  estadoLocal: EstadoLocalCarta | null;
  fotoDestacada: string | null;
  banner?: BannerCarta | null;
  onPedir: () => void;
  onVerCarta: () => void;
}

/** Portada completa (banner + franja), como la usaba la carta antes de poder reordenar secciones. */
export function PortadaCarta({ datosLocal, estadoLocal, fotoDestacada, banner, onPedir, onVerCarta, ...ajustes }: PortadaCartaProps) {
  return (
    <>
      <BannerMesCarta fotoDestacada={fotoDestacada} banner={banner} onPedir={onPedir} onVerCarta={onVerCarta} {...ajustes} />
      <FranjaDatosCarta datosLocal={datosLocal} estadoLocal={estadoLocal} />
    </>
  );
}
