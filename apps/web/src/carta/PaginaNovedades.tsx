import { useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';
import { NovedadDetalle } from './NovedadDetalle';
import { EstadoError } from '../comun/EstadoError';
import { MosaicoMomentos } from './MosaicoMomentos';
import { TextoEd, useEdicion } from './edicion';

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
  /** CHICO, MEDIANO, GRANDE o ANCHO. Ausente o inválido: MEDIANO. */
  tamano?: string;
  orden: number;
  activo: boolean;
  fotos: FotoNovedad[];
}

interface PaginaNovedadesProps {
  novedades?: NovedadCarta[];
  datosLocal?: DatosLocalCarta | null;
  estadoLocal?: EstadoLocalCarta | null;
  onVerCarta: () => void;
  cargando?: boolean;
  error?: string | null;
  alReintentar?: () => void;
  encabezado?: {
    etiqueta?: string;
    titulo?: string;
    subtitulo?: string;
  };
}

export type TamanoNovedad = 'CHICO' | 'MEDIANO' | 'GRANDE' | 'ANCHO';

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

/** Posición en la cuadrícula del contrato: PC de 4 columnas, celular de 2. */
const POSICION_PC: Record<TamanoNovedad, CSSProperties> = {
  CHICO: { gridColumn: 'span 1', gridRow: 'span 1' },
  MEDIANO: { gridColumn: 'span 2', gridRow: 'span 1' },
  GRANDE: { gridColumn: 'span 2', gridRow: 'span 2' },
  ANCHO: { gridColumn: 'span 4', gridRow: 'span 1' },
};
const POSICION_MOVIL: Record<TamanoNovedad, CSSProperties> = {
  CHICO: { gridColumn: 'span 1', gridRow: 'span 1' },
  MEDIANO: { gridColumn: 'span 2', gridRow: 'span 1' },
  GRANDE: { gridColumn: 'span 2', gridRow: 'span 2' },
  ANCHO: { gridColumn: 'span 2', gridRow: 'span 1' },
};

const INSIGNIA: CSSProperties = {
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
  background: 'var(--cp-orange)',
  color: 'var(--cp-navy)',
  borderRadius: 9999,
  padding: '4px 10px',
};

/** Animaciones y efectos. Con prefers-reduced-motion no hay movimiento. */
const ESTILOS = `
@keyframes cp-nov-entrada { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes cp-nov-pulso { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.cp-nov-card { transition: transform .25s ease, box-shadow .25s ease; animation: cp-nov-entrada .55s ease backwards; }
.cp-nov-card:hover { transform: translateY(-4px); box-shadow: 0 14px 28px rgba(11, 44, 62, 0.2); }
.cp-nov-card:has(.cp-nov-abrir:focus-visible) { outline: 2px solid var(--cp-orange); outline-offset: 3px; }
.cp-nov-foto { transition: transform .5s ease; }
.cp-nov-card:hover .cp-nov-foto { transform: scale(1.06); }
.cp-nov-skel { animation: cp-nov-pulso 1.4s ease-in-out infinite; }
.cp-nov-carrusel { scrollbar-width: none; }
.cp-nov-carrusel::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .cp-nov-card, .cp-nov-skel { animation: none !important; transition: none !important; }
  .cp-nov-card:hover { transform: none; }
  .cp-nov-card:hover .cp-nov-foto { transform: none; }
}
`;

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

export function tamanoDeNovedad(n: NovedadCarta): TamanoNovedad {
  const t = (n.tamano || '').toUpperCase();
  return t === 'CHICO' || t === 'GRANDE' || t === 'ANCHO' ? t : 'MEDIANO';
}

export function posicionMosaico(tamano: TamanoNovedad, movil: boolean): CSSProperties {
  return (movil ? POSICION_MOVIL : POSICION_PC)[tamano];
}

function coincideFiltro(n: NovedadCarta, filtro: string): boolean {
  if (filtro === 'todo') return true;
  const t = (n.tipo || '').toUpperCase();
  if (filtro === 'IMAGEN') {
    return t === 'IMAGEN' || t === 'BANNER' || (t === 'AVISO' && /nuevo:/i.test(n.titulo || ''));
  }
  if (filtro === 'FOTOS') {
    return t === 'FOTOS' || t === 'GALERIA';
  }
  return t === filtro.toUpperCase();
}

function MosaicoEsqueleto({ movil }: { movil: boolean }) {
  const tamanos: TamanoNovedad[] = ['GRANDE', 'CHICO', 'CHICO', 'MEDIANO', 'ANCHO', 'CHICO'];
  return (
    <div role="status" aria-label="Cargando novedades" style={estiloMosaico(movil)}>
      {tamanos.map((t, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="cp-nov-skel"
          style={{ ...posicionMosaico(t, movil), borderRadius: movil ? 12 : 16, background: 'color-mix(in srgb, var(--cp-line) 60%, var(--cp-white))' }}
        />
      ))}
    </div>
  );
}

export function estiloMosaico(movil: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: movil ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
    gridAutoRows: movil ? 170 : 230,
    gridAutoFlow: 'dense',
    gap: movil ? 10 : 16,
  };
}

/** Hero (destacadas y banners, hasta 5) y resto del mosaico, como los reparte la página con el filtro «Todo». */
export function agruparNovedades(lista: NovedadCarta[]): { hero: NovedadCarta[]; resto: NovedadCarta[] } {
  const todas = ordenarNovedadesCarta(lista);
  const hero = todas.filter((n) => esNovedadDestacada(n) || (n.tipo || '').toUpperCase() === 'BANNER').slice(0, 5);
  return { hero, resto: todas.filter((n) => !hero.includes(n)) };
}

/** Tarjeta del mosaico de Novedades: la misma en la carta y en la vista de admin. */
export function TarjetaMosaicoNovedad({
  item,
  indice: i,
  movil,
  onAbrir,
}: {
  item: NovedadCarta;
  indice: number;
  movil: boolean;
  onAbrir: (n: NovedadCarta) => void;
}) {
  const ed = useEdicion();
  const radio = movil ? 12 : 16;
  const tamano = tamanoDeNovedad(item);
  const foto = item.fotos[0]?.url;
  const tipoUp = (item.tipo || '').toUpperCase();
  const esVideo = tipoUp === 'VIDEO' || !!item.video_url;
  const esAviso = tipoUp === 'AVISO' && !/nuevo:/i.test(item.titulo || '');
  const compacta = tamano === 'CHICO';
  const tarjeta = (
    <article
      key={item.id}
      data-tamano={tamano}
      className="cp-nov-card"
      style={{
        ...(ed ? { flex: 1, minWidth: 0 } : posicionMosaico(tamano, movil)),
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radio,
        background: 'var(--cp-navy)',
        color: '#FFFFFF',
        margin: 0,
        animationDelay: `${i * 70}ms`,
      }}
    >
      <button
        type="button"
        className="cp-nov-abrir"
        aria-label={`Ver detalle de ${item.titulo}`}
        onClick={() => onAbrir(item)}
        style={{ position: 'absolute', inset: 0, zIndex: 2, border: 0, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 'inherit' }}
      />
      {foto ? (
        <img
          className="cp-nov-foto"
          src={foto}
          alt=""
          loading="lazy"
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {!esAviso && (
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--cp-cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
          )}
        </div>
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(11, 44, 62, 0.92) 0%, rgba(11, 44, 62, 0.35) 45%, rgba(11, 44, 62, 0) 70%)',
        }}
      />
      <span style={{ ...INSIGNIA, position: 'absolute', left: 10, top: 10, zIndex: 1 }}>
        <TextoEd clave={`novedad:${item.id}:tema`} valor={obtenerEtiquetaNovedad(item)} ayuda="Etiqueta de la novedad" />
      </span>
      {esVideo && foto && (
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
            zIndex: 1,
          }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#FFFFFF">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          padding: compacta ? '10px 12px' : movil ? '12px 14px' : '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: ed ? 'auto' : 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: compacta ? 14 : 18,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: compacta ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <TextoEd clave={`novedad:${item.id}:titulo`} valor={item.titulo} ayuda="Título de la novedad" />
        </span>
        {!compacta && (item.texto || ed) && (
          <span
            style={{
              fontSize: 13,
              lineHeight: '18px',
              opacity: 0.92,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <TextoEd clave={`novedad:${item.id}:texto`} valor={item.texto ?? ''} ayuda="Texto de la novedad" />
          </span>
        )}
      </div>
    </article>
  );
  return ed ? ed.bloque(`novedad:${item.id}`, tarjeta, { estilo: posicionMosaico(tamano, movil) }) : tarjeta;
}

export function PaginaNovedades({
  novedades = [],
  datosLocal,
  estadoLocal,
  onVerCarta,
  cargando = false,
  error = null,
  alReintentar,
  encabezado,
}: PaginaNovedadesProps) {
  const movil = useEsMovil();
  const ed = useEdicion();
  const [filtroActivo, setFiltroActivo] = useState('todo');
  const [abierta, setAbierta] = useState<NovedadCarta | null>(null);

  const newsAll = ordenarNovedadesCarta(novedades);
  // Fotos reales de las novedades: el mosaico de Momentos las muestra primero.
  const fotosDeNovedades = newsAll.flatMap((n) => n.fotos.map((f) => f.url)).filter(Boolean);
  const heroItems = newsAll
    .filter((n) => esNovedadDestacada(n) || (n.tipo || '').toUpperCase() === 'BANNER')
    .slice(0, 5);

  const restItems = newsAll.filter(
    (n) => !heroItems.includes(n) && coincideFiltro(n, filtroActivo),
  );
  const baseFiltradas = newsAll.filter((n) => coincideFiltro(n, filtroActivo));
  const novedadesFiltradas =
    filtroActivo === 'todo' && restItems.length > 0 ? restItems : baseFiltradas;

  // Como en el mockup, solo aparecen los filtros que tienen novedades (Todo siempre)
  const chips = FILTROS.map((f) => ({ ...f, cuenta: newsAll.filter((n) => coincideFiltro(n, f.id)).length }))
    .filter((f) => f.id === 'todo' || f.cuenta > 0);

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
  const heroW = movil ? '92%' : '100%';
  const heroAr = movil ? '4 / 3' : '21 / 9';
  const heroPad = movil ? '14px' : '28px';
  const heroTitleFs = movil ? 22 : 34;

  const irCarta = onVerCarta;

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
      <style>{ESTILOS}</style>

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
          data-testid="encabezado-etiqueta"
          style={{
            position: 'relative',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.12em',
            color: 'var(--cp-orange)',
          }}
        >
          <TextoEd clave="enc.etiqueta" valor={encabezado?.etiqueta?.trim() || 'NOVEDADES'} ayuda="Etiqueta del encabezado" />
        </span>
        <span
          data-testid="encabezado-titulo"
          style={{
            position: 'relative',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: abTitleFs,
            lineHeight: abTitleLh,
          }}
        >
          <TextoEd clave="enc.titulo" valor={encabezado?.titulo?.trim() || 'Lo nuevo en Caprichos'} ayuda="Título del encabezado" />
        </span>
        <span
          data-testid="encabezado-subtitulo"
          style={{
            position: 'relative',
            fontSize: abTxt,
            lineHeight: abLh,
            maxWidth: 720,
          }}
        >
          <TextoEd clave="enc.subtitulo" valor={encabezado?.subtitulo?.trim() || 'Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.'} ayuda="Subtítulo del encabezado" />
        </span>
      </div>

      {/* Carrusel de Banners Destacados (líneas 291-308 de Main.dc.html) */}
      {!cargando && !error && heroItems.length > 0 && (
        <>
          <div
            className="cp-nov-carrusel"
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
              const tipoUp = (item.tipo || '').toUpperCase();
              const textoBtn =
                tipoUp === 'BANNER'
                  ? /waffle/i.test(item.titulo || '')
                    ? 'Ver waffles'
                    : 'Ver la carta'
                  : 'Aprovechar';
              const tarjetaHero = (
                <article
                  key={`dest-${item.id}`}
                  style={{
                    position: 'relative',
                    ...(ed ? { flex: 1, minWidth: 0 } : { flex: `0 0 ${heroW}`, scrollSnapAlign: 'start' }),
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
                      alt=""
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
                    aria-hidden="true"
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
                  <button
                    type="button"
                    className="cp-nov-abrir"
                    aria-label={`Ver detalle de ${item.titulo}`}
                    onClick={() => setAbierta(item)}
                    style={{ position: 'absolute', inset: 0, border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}
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
                      pointerEvents: ed ? 'auto' : 'none',
                    }}
                  >
                    <span style={{ ...INSIGNIA, alignSelf: 'flex-start', fontSize: 11 }}>
                      <TextoEd clave={`novedad:${item.id}:tema`} valor={badge} ayuda="Etiqueta de la novedad" />
                    </span>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: heroTitleFs,
                        lineHeight: 1.15,
                      }}
                    >
                      <TextoEd clave={`novedad:${item.id}:titulo`} valor={item.titulo} ayuda="Título de la novedad" />
                    </span>
                    {(item.texto || ed) && (
                      <span style={{ fontSize: abTxt, lineHeight: abLh, opacity: 0.95 }}>
                        <TextoEd clave={`novedad:${item.id}:texto`} valor={item.texto ?? ''} ayuda="Texto de la novedad" />
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
                          pointerEvents: 'auto',
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
                        onClick={irCarta}
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
                          pointerEvents: 'auto',
                        }}
                      >
                        {textoBtn}
                      </button>
                    )}
                  </div>
                </article>
              );
              return ed ? ed.bloque(`novedad:${item.id}`, tarjetaHero, { estilo: { flex: `0 0 ${heroW}`, scrollSnapAlign: 'start' } }) : tarjetaHero;
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
      {!cargando && !error && newsAll.length > 0 && (
        <div
          className="cp-nov-carrusel"
          role="group"
          aria-label="Filtrar novedades"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
          }}
        >
          {chips.map((f) => {
            const activo = filtroActivo === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltroActivo(f.id)}
                aria-pressed={activo}
                className="cp-nov-chip"
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{f.nombre}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    background: activo ? 'var(--cp-orange)' : 'var(--cp-line)',
                    color: 'var(--cp-navy)',
                    borderRadius: 9999,
                    padding: '1px 7px',
                  }}
                >
                  {f.cuenta}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mosaico de novedades: tamaño por novedad según el contrato */}
      {cargando ? (
        <MosaicoEsqueleto movil={movil} />
      ) : error ? (
        <EstadoError
          titulo="No se pudieron cargar las novedades"
          mensaje={error}
          alReintentar={alReintentar}
        />
      ) : novedadesFiltradas.length === 0 && !ed ? (
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
            Pronto tendremos novedades para ti
          </div>
          <div style={{ marginTop: 4 }}>Mientras tanto, mira la carta.</div>
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
        <div style={estiloMosaico(movil)}>
          {novedadesFiltradas.map((item, i) => (
            <TarjetaMosaicoNovedad key={item.id} item={item} indice={i} movil={movil} onAbrir={setAbierta} />
          ))}
          {ed && ed.agregar('novedad', 'Agregar novedad', posicionMosaico('MEDIANO', movil))}
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

      {!cargando && !error && (
        <MosaicoMomentos titulo="Momentos Caprichos" fotos={fotosDeNovedades} cantidad={8} />
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

      {abierta && (
        <NovedadDetalle
          key={abierta.id}
          novedad={abierta}
          etiqueta={obtenerEtiquetaNovedad(abierta)}
          onCerrar={() => setAbierta(null)}
          onVerCarta={irCarta}
        />
      )}
    </div>
  );
}

/** Franja «Novedades» del inicio de la carta: carrusel por arrastre, flechas en PC y ventana de detalle. */
export function FranjaNovedades({
  novedades,
  onVerTodas,
  onVerCarta,
  anchoTarjeta,
}: {
  novedades: NovedadCarta[];
  onVerTodas: () => void;
  onVerCarta: () => void;
  /** Ancho de cada tarjeta (CSS). Sin valor, el tamaño normal de siempre. */
  anchoTarjeta?: string;
}) {
  const movil = useEsMovil();
  const pista = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; izq: number } | null>(null);
  const seArrastro = useRef(false);
  const [abierta, setAbierta] = useState<NovedadCarta | null>(null);

  const desplazar = (d: number) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const alBajar = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !pista.current) return;
    arrastre.current = { x: e.clientX, izq: pista.current.scrollLeft };
    seArrastro.current = false;
  };
  const alMover = (e: RPointerEvent<HTMLDivElement>) => {
    if (!arrastre.current || !pista.current) return;
    const dx = e.clientX - arrastre.current.x;
    if (Math.abs(dx) > 5) seArrastro.current = true;
    pista.current.scrollLeft = arrastre.current.izq - dx;
  };
  const alSoltar = () => {
    arrastre.current = null;
  };
  const alTeclear = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') desplazar(1);
    if (e.key === 'ArrowLeft') desplazar(-1);
  };

  const flecha = (lado: 'left' | 'right'): CSSProperties => ({
    position: 'absolute',
    top: '50%',
    [lado]: -14,
    transform: 'translateY(-50%)',
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    border: '1.5px solid var(--cp-navy)',
    background: 'var(--cp-white)',
    color: 'var(--cp-navy)',
    fontSize: 20,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(11, 44, 62, 0.15)',
  });

  return (
    <section
      aria-label="Novedades"
      style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '20px 16px 0' : '32px 24px 0' }}
    >
      <style>{ESTILOS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: movil ? 17 : 22 }}>Novedades</span>
        <button onClick={onVerTodas} style={{ minHeight: 36, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Ver todas</button>
      </div>
      <div style={{ position: 'relative' }}>
        {!movil && (
          <button type="button" aria-label="Novedad anterior" onClick={() => desplazar(-1)} style={flecha('left')}>‹</button>
        )}
        <div
          ref={pista}
          className="cp-nov-carrusel"
          role="region"
          aria-label="Carrusel de novedades"
          tabIndex={0}
          onKeyDown={alTeclear}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerLeave={alSoltar}
          onDragStart={(e) => e.preventDefault()}
          style={{ display: 'flex', gap: movil ? 10 : 16, overflowX: 'auto', paddingBottom: 4, cursor: 'grab', userSelect: 'none' }}
        >
          {novedades.map((n) => {
            const badge = obtenerEtiquetaNovedad(n);
            const esAviso = (n.tipo || '').toUpperCase() === 'AVISO' && badge !== 'NOVEDAD';
            const fotoPrincipal = n.fotos[0]?.url ?? '';
            return (
              <button
                key={n.id}
                type="button"
                aria-label={`Ver detalle de ${n.titulo}`}
                onClick={() => {
                  if (!seArrastro.current) setAbierta(n);
                }}
                style={{
                  flex: `0 0 ${anchoTarjeta ?? (movil ? '66%' : '300px')}`,
                  border: '1px solid var(--cp-line)',
                  padding: 0,
                  borderRadius: movil ? 14 : 20,
                  background: esAviso ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: esAviso ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  textAlign: 'left',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                }}
              >
                {fotoPrincipal && (
                  <span style={{ position: 'relative', display: 'block', width: '100%', aspectRatio: '16 / 9', background: 'var(--cp-gold)' }}>
                    <img src={fotoPrincipal} alt="" loading="lazy" draggable={false} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', left: 8, top: 8, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '3px 9px' }}>
                      {badge}
                    </span>
                  </span>
                )}
                <span style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {!fotoPrincipal && (
                    <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '3px 9px' }}>
                      {badge}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 14, lineHeight: '18px' }}>{n.titulo}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!movil && (
          <button type="button" aria-label="Novedad siguiente" onClick={() => desplazar(1)} style={flecha('right')}>›</button>
        )}
      </div>
      {abierta && (
        <NovedadDetalle
          key={abierta.id}
          novedad={abierta}
          etiqueta={obtenerEtiquetaNovedad(abierta)}
          onCerrar={() => setAbierta(null)}
          onVerCarta={onVerCarta}
        />
      )}
    </section>
  );
}
