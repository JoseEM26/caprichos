import { useState, type CSSProperties } from 'react';
import { DatosLocalCarta, EstadoLocalCarta } from './tipos';
import { useEsMovil } from './useEsMovil';

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

const ETIQUETA: Record<string, string> = { PROMOCION: 'PROMO', BANNER: 'EN PORTADA', VIDEO: 'VIDEO', FOTOS: 'FOTOS', EVENTO: 'EVENTO', AVISO: 'AVISO', IMAGEN: 'NOVEDAD' };

const FILTROS = [
  { id: 'todo', nombre: 'Todo' },
  { id: 'PROMOCION', nombre: 'Promociones' },
  { id: 'VIDEO', nombre: 'Videos' },
  { id: 'BANNER', nombre: 'Novedades' },
  { id: 'FOTOS', nombre: 'Fotos' },
  { id: 'EVENTO', nombre: 'Eventos' },
  { id: 'AVISO', nombre: 'Avisos' },
];

export function PaginaNovedades({ novedades = [], datosLocal, estadoLocal, onVerCarta }: PaginaNovedadesProps) {
  const movil = useEsMovil();
  const [filtroActivo, setFiltroActivo] = useState('todo');
  const [fotoModal, setFotoModal] = useState<string | null>(null);

  const destacados = novedades.filter((n) => n.tipo === 'BANNER');
  const listaDestacados = destacados;

  const baseFiltradas = novedades.filter((n) => {
    if (filtroActivo === 'todo') return true;
    return (n.tipo || '').toUpperCase() === filtroActivo.toUpperCase();
  });
  const sinHero = baseFiltradas.filter((n) => !listaDestacados.includes(n));
  const novedadesFiltradas = filtroActivo === 'todo' && sinHero.length > 0 ? sinHero : baseFiltradas;

  const mediosPago = Object.entries(datosLocal?.mediosPago ?? {})
    .filter(([, m]) => m.activo)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const redes = Object.entries(datosLocal?.redes ?? {}).filter(([, v]) => v);
  const urlRed = (red: string, valor: string) =>
    /^https?:/.test(valor) ? valor : `https://${red}.com/${red === 'tiktok' ? '@' : ''}${valor.replace(/^@/, '')}`;
  const infoTiles = [
    estadoLocal && { k: 'HORARIO', v: estadoLocal.texto },
    datosLocal?.envioGratisDesde != null && { k: 'DELIVERY', v: `Gratis desde s/ ${datosLocal.envioGratisDesde}` },
    mediosPago.length > 0 && { k: 'PAGOS', v: mediosPago.join(' · ') },
    datosLocal?.direccion && { k: 'UBICACIÓN', v: datosLocal.direccion },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        maxWidth: 1200,
        margin: '0 auto',
        padding: movil ? '12px 16px 40px' : '24px 24px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: movil ? 12 : 20,
      }}
    >
      {/* Cabecera visual de la sección */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(155deg, var(--cp-navy) 55%, #3b5a3f)',
          color: 'var(--cp-cream)',
          borderRadius: movil ? 14 : 20,
          padding: movil ? 18 : 32,
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
            fontFamily: 'var(--fuente-titulos)',
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
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: movil ? 22 : 34,
            lineHeight: movil ? '28px' : '42px',
          }}
        >
          Lo nuevo en Caprichos
        </span>
        <span
          style={{
            position: 'relative',
            fontSize: movil ? 14 : 16,
            lineHeight: '22px',
            maxWidth: 720,
            opacity: 0.95,
          }}
        >
          Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.
        </span>
      </div>

      {/* Carrusel de Banners Destacados */}
      {listaDestacados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            aria-label="Destacados"
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              paddingBottom: 4,
            }}
          >
            {listaDestacados.map((item) => {
              const foto = item.fotos[0]?.url;
              return (
                <div
                  key={`dest-${item.id}`}
                  style={{
                    position: 'relative',
                    flex: '0 0 100%',
                    scrollSnapAlign: 'start',
                    aspectRatio: movil ? '16 / 9' : '21 / 9',
                    borderRadius: movil ? 14 : 16,
                    overflow: 'hidden',
                    background: 'var(--cp-navy)',
                    color: '#FFFFFF',
                  }}
                >
                  {foto ? (
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
                  ) : null}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '25% 0px 0px',
                      background: 'linear-gradient(to top, rgba(11, 44, 62, 0.92), rgba(11, 44, 62, 0))',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: movil ? '16px' : '28px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        borderRadius: 9999,
                        padding: '4px 10px',
                      }}
                    >
                      {ETIQUETA[item.tipo] ?? item.tipo}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: movil ? 20 : 32,
                        lineHeight: 1.15,
                      }}
                    >
                      {item.titulo}
                    </span>
                    {item.texto && (
                      <span
                        style={{
                          fontSize: movil ? 13 : 15,
                          lineHeight: movil ? '18px' : '22px',
                          opacity: 0.95,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.texto}
                      </span>
                    )}
                    <button
                      onClick={onVerCarta}
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 4,
                        minHeight: 40,
                        padding: '0 18px',
                        border: 0,
                        borderRadius: 12,
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      Ver la carta
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {listaDestacados.length > 1 && (
            <div style={{ fontSize: 11, color: 'var(--cp-soft)', textAlign: 'center' }}>
              Desliza para ver más
            </div>
          )}
        </div>
      )}

      {/* Barra de filtros */}
      <div
        role="group"
        aria-label="Filtrar novedades"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {FILTROS.map((f) => {
          const activo = filtroActivo === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroActivo(f.id)}
              style={{
                flex: '0 0 auto',
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

      {/* Grid de novedades */}
      {novedadesFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--cp-soft)' }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy)' }}>
            Aún no hay novedades
          </div>
          <div style={{ marginTop: 4 }}>Vuelve pronto o mira la carta.</div>
          <button
            onClick={onVerCarta}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: '0 20px',
              border: 0,
              borderRadius: 12,
              background: 'var(--cp-orange)',
              color: '#FFFFFF',
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
            gap: 16,
            alignItems: 'start',
          }}
        >
          {novedadesFiltradas.map((item) => {
            const foto = item.fotos[0]?.url;
            const esVideo = item.tipo === 'VIDEO' || !!item.video_url;
            const esAviso = item.tipo === 'AVISO' && !foto;
            const etiqueta = ETIQUETA[item.tipo] ?? item.tipo;
            const insignia: CSSProperties = {
              fontFamily: 'var(--fuente-titulos)',
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
              ? `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}${item.evento_lugar ? ` · ${item.evento_lugar}` : ''}`
              : null;

            return (
              <article
                key={item.id}
                style={{
                  background: esAviso ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: esAviso ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {!esAviso && (
                  <div
                    onClick={() => foto && setFotoModal(foto)}
                    style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--cp-gold)', cursor: foto ? 'pointer' : 'default' }}
                  >
                    {foto && <img src={foto} alt={item.titulo} loading="lazy" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <span style={{ ...insignia, position: 'absolute', left: 10, top: 10 }}>{etiqueta}</span>
                    {esVideo && (
                      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 56, height: 56, borderRadius: 28, background: 'rgba(11, 44, 62, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="#FFFFFF"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    )}
                  </div>
                )}

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {esAviso && <span style={{ ...insignia, alignSelf: 'flex-start' }}>{etiqueta}</span>}
                  <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{item.titulo}</div>
                  {(lineaEvento || item.texto) && (
                    <div style={{ fontSize: 15, lineHeight: '22px', opacity: 0.92, whiteSpace: 'pre-line' }}>
                      {[lineaEvento, item.texto].filter(Boolean).join('\n')}
                    </div>
                  )}
                  {item.video_url && (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginTop: 4, minHeight: 48, boxSizing: 'border-box', borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                    >
                      {item.video_url.includes('tiktok') ? 'Ver en TikTok' : item.video_url.includes('instagram') ? 'Ver en Instagram' : 'Ver video'}
                    </a>
                  )}
                  {!item.video_url && (item.tipo === 'PROMOCION' || item.tipo === 'BANNER') && (
                    <button
                      onClick={onVerCarta}
                      style={{ marginTop: 4, minHeight: 48, border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
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
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>Antes de venir</div>
          <div style={{ display: 'grid', gridTemplateColumns: movil ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
            {infoTiles.map((t) => (
              <div key={t.k} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cp-rust)' }}>{t.k}</span>
                <span style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600 }}>{t.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {redes.length > 0 && (
        <div style={{ background: 'var(--cp-navy)', color: 'var(--cp-cream)', borderRadius: movil ? 14 : 20, padding: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>Síguenos y entérate primero</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {redes.map(([r, v]) => (
              <a
                key={r}
                href={urlRed(r, v!)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ minHeight: 40, padding: '0 14px', boxSizing: 'border-box', borderRadius: 9999, border: '1.5px solid var(--cp-cream)', color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                {r === 'tiktok' ? 'TikTok' : r.charAt(0).toUpperCase() + r.slice(1)}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Modal visor de foto ampliada */}
      {fotoModal && (
        <div
          onClick={() => setFotoModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <img
            src={fotoModal}
            alt="Vista previa ampliada"
            style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
}
