import { useState, type CSSProperties } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';
import { VisorHistoriasModal, type HistoriaCírculo } from './contenido/VisorHistoriasModal';

export interface FotoNovedad {
  id: string;
  url: string;
}

export interface NovedadCarta {
  id: string;
  tipo: string;
  titulo: string;
  texto?: string;
  tema?: string;
  video_url?: string;
  evento_fecha?: string;
  evento_lugar?: string;
  orden: number;
  activo: boolean;
  fotos: FotoNovedad[];
}

interface PaginaNovedadesProps {
  novedades?: NovedadCarta[];
  datosLocal?: DatosLocalCarta | null;
  estadoLocal?: EstadoLocalCarta | null;
  onVerCarta: () => void;
}

const ETIQUETA: Record<string, string> = {
  PROMOCION: 'PROMO',
  PROMO: 'PROMO',
  BANNER: 'EN PORTADA',
  VIDEO: 'VIDEO',
  FOTOS: 'GALERÍA',
  GALERIA: 'GALERÍA',
  EVENTO: 'EVENTO',
  AVISO: 'AVISO',
  IMAGEN: 'NOVEDAD',
};

const FILTROS = [
  { id: 'todo', nombre: 'Todo' },
  { id: 'PROMOCION', nombre: 'Promociones' },
  { id: 'VIDEO', nombre: 'Videos' },
  { id: 'IMAGEN', nombre: 'Novedades' },
  { id: 'FOTOS', nombre: 'Fotos' },
  { id: 'EVENTO', nombre: 'Eventos' },
  { id: 'AVISO', nombre: 'Avisos' },
];

export function esNovedadDestacada(n: NovedadCarta): boolean {
  if (n.tema && /destacad/i.test(n.tema)) return true;
  if (/martes de 2x1/i.test(n.titulo || '')) return true;
  return false;
}

export function ordenarNovedadesCarta(lista: NovedadCarta[]): NovedadCarta[] {
  return [...lista].sort(
    (a, b) => (esNovedadDestacada(b) ? 1 : 0) - (esNovedadDestacada(a) ? 1 : 0),
  );
}

export function obtenerEtiquetaNovedad(n: NovedadCarta): string {
  if (n.tema && !/destacad/i.test(n.tema)) {
    return String(n.tema).toUpperCase();
  }
  const t = (n.tipo || '').toUpperCase();
  if (t === 'AVISO' && /nuevo:/i.test(n.titulo || '')) return 'NOVEDAD';
  return ETIQUETA[t] ?? 'NOVEDAD';
}

export function PaginaNovedades({
  novedades = [],
  datosLocal,
  estadoLocal,
  onVerCarta,
}: PaginaNovedadesProps) {
  const movil = useEsMovil();
  const [filtroActivo, setFiltroActivo] = useState('todo');
  const [galeriaActiva, setGaleriaActiva] = useState<HistoriaCírculo | null>(null);

  const newsAll = ordenarNovedadesCarta(novedades);
  const heroItems = newsAll
    .filter((n) => esNovedadDestacada(n) || (n.tipo || '').toUpperCase() === 'BANNER')
    .slice(0, 5);

  const coincideFiltro = (n: NovedadCarta, filtro: string): boolean => {
    if (filtro === 'todo') return true;
    const t = (n.tipo || '').toUpperCase();
    if (filtro === 'IMAGEN') {
      return t === 'IMAGEN' || t === 'BANNER' || (t === 'AVISO' && /nuevo:/i.test(n.titulo || ''));
    }
    if (filtro === 'FOTOS') {
      return t === 'FOTOS' || t === 'GALERIA';
    }
    return t === filtro.toUpperCase();
  };

  const restItems = newsAll.filter(
    (n) => !heroItems.includes(n) && coincideFiltro(n, filtroActivo),
  );
  const baseFiltradas = newsAll.filter((n) => coincideFiltro(n, filtroActivo));
  const novedadesFiltradas =
    filtroActivo === 'todo' && restItems.length > 0 ? restItems : baseFiltradas;

  const mediosPago = Object.entries(datosLocal?.mediosPago ?? {})
    .filter(([, m]) => m.activo)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const redes = Object.entries(datosLocal?.redes ?? {}).filter(([, v]) => v);
  const urlRed = (red: string, valor: string) =>
    /^https?:/.test(valor)
      ? valor
      : `https://${red}.com/${red === 'tiktok' ? '@' : ''}${valor.replace(/^@/, '')}`;

  const infoTiles = [
    estadoLocal && { k: 'HORARIO', v: estadoLocal.texto },
    datosLocal?.envioGratisDesde != null && {
      k: 'DELIVERY',
      v: `Gratis por compras de más de s/ ${datosLocal.envioGratisDesde}${
        datosLocal.pedidoMinimo ? ` · pedido mínimo s/ ${datosLocal.pedidoMinimo.toFixed(2)}` : ''
      }`,
    },
    mediosPago.length > 0 && { k: 'PAGOS', v: mediosPago.join(' · ') },
    datosLocal?.direccion && { k: 'UBICACIÓN', v: datosLocal.direccion },
  ].filter(Boolean) as { k: string; v: string }[];

  const abOuter = movil ? '12px 16px 40px' : '24px 24px 64px';
  const abGap = movil ? 12 : 16;
  const abRad = movil ? 12 : 16;
  const abHeroPad = movil ? '16px' : '28px 24px';
  const abTitleFs = movil ? 20 : 30;
  const abTitleLh = movil ? '25px' : '36px';
  const abTxt = movil ? 13 : 15;
  const abLh = movil ? '19px' : '22px';
  const abCardPad = movil ? '14px' : '20px';
  const abH = movil ? 15 : 18;
  const abBtn = movil ? 44 : 48;
  const heroW = movil ? '92%' : '100%';
  const heroAr = movil ? '4 / 3' : '21 / 9';
  const heroPad = movil ? '14px' : '28px';
  const heroTitleFs = movil ? 22 : 34;

  const abrirGaleriaNovedad = (item: NovedadCarta) => {
    const fotos = (item.fotos || []).filter((f) => f.url);
    if (fotos.length === 0) return;
    setGaleriaActiva({
      id: item.id,
      titulo: item.titulo,
      portada_url: fotos[0]?.url || null,
      fotos: fotos.map((f, idx) => ({
        id: f.id || `${item.id}-${idx}`,
        url: f.url,
        pie: item.titulo,
      })),
    });
  };

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: 1200,
        margin: '0 auto',
        padding: abOuter,
        display: 'flex',
        flexDirection: 'column',
        gap: abGap,
      }}
    >
      {/* Cabecera visual de la sección (líneas 285-290 de Main.dc.html) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(155deg, var(--cp-navy) 55%, color-mix(in srgb, var(--cp-navy) 65%, var(--cp-orange)))',
          color: 'var(--cp-cream)',
          borderRadius: abRad,
          padding: abHeroPad,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -50,
            top: -50,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'var(--cp-orange)',
            opacity: 0.16,
          }}
        />
        <span
          style={{
            position: 'relative',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.12em',
            color: 'var(--cp-orange)',
          }}
        >
          NOVEDADES
        </span>
        <span
          style={{
            position: 'relative',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: abTitleFs,
            lineHeight: abTitleLh,
          }}
        >
          Lo nuevo en Caprichos
        </span>
        <span
          style={{
            position: 'relative',
            fontSize: abTxt,
            lineHeight: abLh,
            maxWidth: 720,
          }}
        >
          Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.
        </span>
      </div>

      {/* Carrusel de Banners Destacados (líneas 291-308 de Main.dc.html) */}
      {heroItems.length > 0 && (
        <>
          <div
            className="noscroll"
            aria-label="Destacados"
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
            }}
          >
            {heroItems.map((item) => {
              const foto = item.fotos[0]?.url;
              const badge = obtenerEtiquetaNovedad(item);
              const textoBtn =
                (item.tipo || '').toUpperCase() === 'BANNER'
                  ? /waffle/i.test(item.titulo || '')
                    ? 'Ver waffles'
                    : 'Ver la carta'
                  : 'Aprovechar';
              return (
                <div
                  key={`dest-${item.id}`}
                  style={{
                    position: 'relative',
                    flex: `0 0 ${heroW}`,
                    scrollSnapAlign: 'start',
                    aspectRatio: heroAr,
                    borderRadius: abRad,
                    overflow: 'hidden',
                    background: 'var(--cp-navy)',
                    color: '#FFFFFF',
                  }}
                >
                  {foto && (
                    <img
                      src={foto}
                      alt={item.titulo}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      top: '35%',
                      background:
                        'linear-gradient(to top, rgba(11, 44, 62, 0.92), rgba(11, 44, 62, 0))',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: heroPad,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        borderRadius: 9999,
                        padding: '4px 10px',
                      }}
                    >
                      {badge}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: heroTitleFs,
                        lineHeight: 1.15,
                      }}
                    >
                      {item.titulo}
                    </span>
                    {item.texto && (
                      <span
                        style={{
                          fontSize: abTxt,
                          lineHeight: abLh,
                          opacity: 0.95,
                        }}
                      >
                        {item.texto}
                      </span>
                    )}
                    {item.video_url ? (
                      <a
                        href={item.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          alignSelf: 'flex-start',
                          minHeight: 44,
                          padding: '0 18px',
                          boxSizing: 'border-box',
                          borderRadius: 12,
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        {item.video_url.includes('tiktok')
                          ? 'Ver en TikTok'
                          : item.video_url.includes('instagram')
                            ? 'Ver en Instagram'
                            : 'Ver más'}
                      </a>
                    ) : (
                      <button
                        onClick={onVerCarta}
                        style={{
                          alignSelf: 'flex-start',
                          minHeight: 44,
                          padding: '0 18px',
                          border: 0,
                          borderRadius: 12,
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {textoBtn}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--cp-soft)',
              marginTop: -6,
              textAlign: 'center',
            }}
          >
            Desliza para ver más
          </div>
        </>
      )}

      {/* Barra de filtros (línea 309 de Main.dc.html) */}
      <div
        className="noscroll"
        role="group"
        aria-label="Filtrar novedades"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
        }}
      >
        {FILTROS.map((f) => {
          const activo = filtroActivo === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroActivo(f.id)}
              style={{
                flex: 'none',
                minHeight: 40,
                padding: '0 14px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: activo ? 'var(--cp-navy)' : 'transparent',
                color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {f.nombre}
            </button>
          );
        })}
      </div>

      {/* Grid de novedades (líneas 310-328 de Main.dc.html) */}
      {novedadesFiltradas.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--cp-soft)',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--cp-navy)',
            }}
          >
            Aún no hay novedades
          </div>
          <div style={{ marginTop: 4 }}>
            Pronto habrá más novedades. Mientras tanto, mira la carta.
          </div>
          <button
            onClick={onVerCarta}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: '0 20px',
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Ver la carta
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: movil ? '1fr' : 'repeat(2, 1fr)',
            gap: abGap,
            alignItems: 'start',
          }}
        >
          {novedadesFiltradas.map((item) => {
            const foto = item.fotos[0]?.url;
            const extras = (item.fotos || []).slice(1).filter((f) => f.url);
            const tipoUp = (item.tipo || '').toUpperCase();
            const esVideo = tipoUp === 'VIDEO' || !!item.video_url;
            const esAviso = tipoUp === 'AVISO' && !/nuevo:/i.test(item.titulo || '');
            const etiqueta = obtenerEtiquetaNovedad(item);
            const insignia: CSSProperties = {
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: '0.08em',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              borderRadius: 9999,
              padding: '4px 10px',
            };
            const fecha = item.evento_fecha ? new Date(item.evento_fecha) : null;
            const lineaEvento = fecha
              ? `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(
                  fecha.getUTCMonth() + 1,
                ).padStart(2, '0')}${item.evento_lugar ? ` · ${item.evento_lugar}` : ''}`
              : null;

            return (
              <article
                key={item.id}
                style={{
                  background: esAviso ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: esAviso ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: abRad,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {foto ? (
                  <div
                    onClick={() => abrirGaleriaNovedad(item)}
                    style={{
                      position: 'relative',
                      aspectRatio: '16 / 10',
                      background: 'var(--cp-gold)',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={foto}
                      alt={item.titulo}
                      loading="lazy"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <span style={{ ...insignia, position: 'absolute', left: 10, top: 10 }}>
                      {etiqueta}
                    </span>
                    {esVideo && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          background: 'rgba(11, 44, 62, 0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="#FFFFFF">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
                  </div>
                ) : (
                  !esAviso && (
                    <div
                      style={{
                        position: 'relative',
                        aspectRatio: '16 / 10',
                        background: 'color-mix(in srgb, var(--cp-line) 55%, var(--cp-white))',
                        color: 'var(--cp-soft)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ ...insignia, position: 'absolute', left: 10, top: 10 }}>
                        {etiqueta}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        width="34"
                        height="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                        <circle cx="12" cy="13.5" r="3.5" />
                      </svg>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                        }}
                      >
                        FOTO O VIDEO
                      </span>
                    </div>
                  )
                )}

                {extras.length > 0 && (
                  <button
                    onClick={() => abrirGaleriaNovedad(item)}
                    aria-label={`Ver todas las fotos de ${item.titulo}`}
                    style={{
                      border: 0,
                      padding: 6,
                      background: 'var(--cp-white)',
                      display: 'flex',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {extras.slice(0, 3).map((x, i) => {
                      const more = i === 2 && extras.length > 3;
                      return (
                        <span
                          key={x.id || i}
                          style={{
                            position: 'relative',
                            flex: 1,
                            aspectRatio: '1 / 1',
                            borderRadius: 10,
                            overflow: 'hidden',
                            background: 'var(--cp-gold)',
                          }}
                        >
                          <img
                            src={x.url}
                            alt=""
                            loading="lazy"
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          {more && (
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(11, 44, 62, 0.6)',
                                color: '#FFFFFF',
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 800,
                                fontSize: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              +{extras.length - 2}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </button>
                )}

                <div
                  style={{
                    padding: abCardPad,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {esAviso && !foto && (
                    <span style={{ ...insignia, alignSelf: 'flex-start' }}>{etiqueta}</span>
                  )}
                  <div
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: abH,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.titulo}
                  </div>
                  {(lineaEvento || item.texto) && (
                    <div
                      style={{
                        fontSize: abTxt,
                        lineHeight: abLh,
                        opacity: 0.92,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {[lineaEvento, item.texto].filter(Boolean).join('\n')}
                    </div>
                  )}
                  {item.video_url && (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginTop: 4,
                        minHeight: abBtn,
                        boxSizing: 'border-box',
                        borderRadius: 12,
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {item.video_url.includes('tiktok')
                        ? 'Ver en TikTok'
                        : item.video_url.includes('instagram')
                          ? 'Ver en Instagram'
                          : 'Ver más'}
                    </a>
                  )}
                  {!item.video_url &&
                    (tipoUp === 'PROMOCION' || tipoUp === 'PROMO' || tipoUp === 'BANNER') && (
                      <button
                        onClick={onVerCarta}
                        style={{
                          marginTop: 4,
                          minHeight: abBtn,
                          border: 0,
                          borderRadius: 12,
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Aprovechar
                      </button>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {infoTiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: abH,
            }}
          >
            Antes de venir
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: movil ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 10,
            }}
          >
            {infoTiles.map((t) => (
              <div
                key={t.k}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 16,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--cp-rust)',
                  }}
                >
                  {t.k}
                </span>
                <span style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600 }}>
                  {t.v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {redes.length > 0 && (
        <div
          style={{
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            borderRadius: abRad,
            padding: abCardPad,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: abH,
            }}
          >
            Síguenos y entérate primero
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {redes.map(([r, v]) => (
              <a
                key={r}
                href={urlRed(r, v!)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  minHeight: 40,
                  padding: '0 14px',
                  boxSizing: 'border-box',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-cream)',
                  color: 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                {r === 'tiktok' ? 'TikTok' : r.charAt(0).toUpperCase() + r.slice(1)}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Visor de imágenes de la galería */}
      {galeriaActiva && (
        <VisorHistoriasModal
          historias={[galeriaActiva]}
          destacadaIdxInicial={0}
          onCerrar={() => setGaleriaActiva(null)}
        />
      )}
    </div>
  );
}
