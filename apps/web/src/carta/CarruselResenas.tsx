import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../comun/api';
import { useEsMovil } from './useEsMovil';

export interface ResenaCarta {
  id: string;
  autor: string;
  foto: string | null;
  estrellas: number;
  texto: string;
  fecha: string | null;
  enlace: string | null;
}

export interface RespuestaResenasCarta {
  resenas: ResenaCarta[];
  resumen: { rating: number; total: number } | null;
  enlaceLocal?: string | null;
}

const INTERVALO_MS = 6000;
const LARGO_TEXTO = 220;
const TAMANO_CONTROL = 44;
const SEPARACION = 20;
const COLORES_INICIAL = ['#E67929', '#B2500F', '#D99E39', '#2F6B5E', '#5B4B8A'];

/** Mezcla (Fisher-Yates) para que cada visita empiece con otra reseña. */
export function barajar<T>(lista: T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function recortarTexto(texto: string): string {
  return texto.length > LARGO_TEXTO ? `${texto.slice(0, LARGO_TEXTO).trimEnd()}...` : texto;
}

function mesYAnio(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const s = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function movimientoReducido(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Foto del autor; si no carga (o no hay), un círculo con la inicial del nombre. */
export function FotoAutor({ nombre, url }: { nombre: string; url: string | null }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: 44, height: 44, borderRadius: '50%', flexShrink: 0, boxShadow: '0 0 0 2px var(--cp-white), 0 0 0 4px var(--cp-sand)' } as const;
  if (!url || fallo) {
    const inicial = (nombre.trim().charAt(0) || '?').toUpperCase();
    const color = COLORES_INICIAL[inicial.charCodeAt(0) % COLORES_INICIAL.length];
    return (
      <span
        aria-hidden="true"
        style={{ ...estilo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: color, color: '#fff', fontWeight: 800, fontSize: 17 }}
      >
        {inicial}
      </span>
    );
  }
  return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFallo(true)} style={{ ...estilo, objectFit: 'cover' }} />;
}

export function Estrellas({ valor, tamano, etiqueta }: { valor: number; tamano: number; etiqueta?: string }) {
  return (
    <span role="img" aria-label={etiqueta ?? `${valor} de 5 estrellas`} style={{ fontSize: tamano, letterSpacing: 2, lineHeight: 1 }}>
      <span style={{ color: 'var(--cp-gold)' }}>{'★'.repeat(valor)}</span>
      <span style={{ color: 'var(--cp-line)' }}>{'★'.repeat(5 - valor)}</span>
    </span>
  );
}

/** Acciones opcionales (p. ej. ocultar o mostrar) van en un pie; `atenuada` la muestra apagada. La carta no las usa. */
export function TarjetaResena({ r, oculta, acciones, atenuada = false }: { r: ResenaCarta; oculta: boolean; acciones?: ReactNode; atenuada?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const estrellas = Math.max(0, Math.min(5, Math.round(r.estrellas)));
  const fecha = mesYAnio(r.fecha);
  const larga = r.texto.length > LARGO_TEXTO;
  return (
    <article
      aria-hidden={oculta || undefined}
      style={{
        position: 'relative',
        background: 'var(--cp-white)',
        borderRadius: 20,
        padding: '22px 22px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        opacity: atenuada ? 0.6 : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'absolute', top: -18, right: 14, fontFamily: 'Georgia, serif', fontSize: 120, lineHeight: 1, color: 'var(--cp-orange)', opacity: 0.12, pointerEvents: 'none' }}
      >
        &rdquo;
      </span>
      <Estrellas valor={estrellas} tamano={17} />
      <p style={{ margin: 0, fontSize: 15, lineHeight: '24px', color: 'var(--cp-navy)', flex: 1 }}>
        {abierta || !larga ? r.texto : recortarTexto(r.texto)}
        {larga && (
          <button
            type="button"
            tabIndex={oculta ? -1 : undefined}
            onClick={() => setAbierta((a) => !a)}
            style={{ marginLeft: 6, border: 'none', background: 'none', padding: 0, color: 'var(--cp-rust)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            {abierta ? 'Ver menos' : 'Leer más'}
          </button>
        )}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px dashed var(--cp-line)' }}>
        <FotoAutor nombre={r.autor} url={r.foto} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.autor}</span>
          <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            {fecha ? `${fecha} · ` : ''}Reseña de Google
          </span>
        </div>
      </div>
      {r.enlace && (
        <a
          href={r.enlace}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={oculta ? -1 : undefined}
          style={{ alignSelf: 'flex-start', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 13, minHeight: 32, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          Ver en Google Maps
        </a>
      )}
      {acciones && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px dashed var(--cp-line)' }}>{acciones}</div>}
    </article>
  );
}

/** Reseñas buenas de Google Maps, justo antes de «Deja tu opinión»: varias tarjetas a la vez que avanzan solas. Sin reseñas, no se muestra nada. */
export function CarruselResenas() {
  const movil = useEsMovil();
  const [datos, setDatos] = useState<RespuestaResenasCarta | null>(null);
  const [orden, setOrden] = useState<ResenaCarta[]>([]);
  const [idx, setIdx] = useState(0);
  const [conRaton, setConRaton] = useState(false);
  const [conFoco, setConFoco] = useState(false);
  const toque = useRef<number | null>(null);
  const reducido = movimientoReducido();

  useEffect(() => {
    let vivo = true;
    api
      .get<RespuestaResenasCarta>('/carta/resenas')
      .then((r) => {
        if (!vivo || !r) return;
        setDatos(r);
        setOrden(barajar(r.resenas ?? []));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const n = orden.length;
  // PC: 3 tarjetas a la vez; celular: 1 y se asoma la siguiente
  const porVista = movil ? 1 : Math.min(3, n);
  const ultimo = Math.max(0, n - porVista);
  const pos = Math.min(idx, ultimo);
  const pausado = conRaton || conFoco;

  useEffect(() => {
    if (ultimo === 0 || pausado || reducido) return;
    const t = setInterval(() => setIdx((i) => (Math.min(i, ultimo) >= ultimo ? 0 : i + 1)), INTERVALO_MS);
    return () => clearInterval(t);
  }, [ultimo, pausado, reducido, idx]);

  if (!datos || n === 0) return null;

  const ir = (i: number) => setIdx(Math.max(0, Math.min(i, ultimo)));
  const siguiente = () => setIdx(pos >= ultimo ? 0 : pos + 1);
  const anterior = () => setIdx(pos <= 0 ? ultimo : pos - 1);
  const total = datos.resumen?.total ?? 0;
  const ancho = movil ? '86%' : `calc((100% - ${(porVista - 1) * SEPARACION}px) / ${porVista})`;
  const flecha = {
    width: TAMANO_CONTROL,
    height: TAMANO_CONTROL,
    borderRadius: 9999,
    border: '1.5px solid rgba(251,244,236,0.45)',
    background: 'rgba(251,244,236,0.06)',
    color: 'var(--cp-cream)',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const flechas = ultimo > 0 && (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" aria-label="Reseña anterior" style={flecha} onClick={anterior}>
        ‹
      </button>
      <button type="button" aria-label="Reseña siguiente" style={flecha} onClick={siguiente}>
        ›
      </button>
    </div>
  );

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Reseñas de Google"
      onMouseEnter={() => setConRaton(true)}
      onMouseLeave={() => setConRaton(false)}
      onFocus={() => setConFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setConFoco(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') siguiente();
        if (e.key === 'ArrowLeft') anterior();
      }}
      style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '28px 16px 0' : '48px 24px 0' }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 92% 0%, rgba(230,121,41,0.35), transparent 45%), radial-gradient(circle at 0% 100%, rgba(217,158,57,0.18), transparent 40%), var(--cp-navy)',
          borderRadius: movil ? 22 : 28,
          padding: movil ? '24px 0 22px' : '36px 36px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: movil ? 20 : 26,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: movil ? '0 20px' : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 12, letterSpacing: '0.14em', color: 'var(--cp-orange)' }}>
              LO QUE DICEN EN GOOGLE
            </span>
            <h2 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontSize: movil ? 26 : 34, lineHeight: 1.1, color: 'var(--cp-cream)' }}>
              Clientes que vuelven por más
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {datos.resumen && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--cp-cream)',
                  borderRadius: 16,
                  padding: '10px 16px',
                }}
              >
                <span style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 34, fontWeight: 800, lineHeight: 1, color: 'var(--cp-navy)' }}>
                  {datos.resumen.rating.toFixed(1)}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Estrellas valor={Math.round(datos.resumen.rating)} tamano={15} etiqueta={`Calificación ${datos.resumen.rating} de 5`} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>{`${datos.resumen.rating} en Google · ${total} ${total === 1 ? 'reseña' : 'reseñas'}`}</span>
                </span>
              </div>
            )}
            {datos.enlaceLocal && (
              <a
                href={datos.enlaceLocal}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--cp-cream)', fontWeight: 700, fontSize: 13, textDecoration: 'underline', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}
              >
                Ver todas en Google
              </a>
            )}
            {!movil && flechas}
          </div>
        </div>

        <div
          style={{ overflow: 'hidden', padding: movil ? '0 20px' : 0 }}
          onTouchStart={(e) => {
            toque.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (toque.current === null) return;
            const dx = e.changedTouches[0].clientX - toque.current;
            toque.current = null;
            if (dx < -40) siguiente();
            if (dx > 40) anterior();
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: SEPARACION,
              alignItems: 'stretch',
              transform: `translateX(calc(-${pos} * (${ancho} + ${SEPARACION}px)))`,
              transition: reducido ? 'none' : 'transform 650ms cubic-bezier(.22,.8,.24,1)',
              paddingBottom: 6,
            }}
          >
            {orden.map((r, i) => (
              <div key={r.id} style={{ flex: `0 0 ${ancho}`, display: 'flex', flexDirection: 'column' }}>
                <TarjetaResena r={r} oculta={i < pos || i >= pos + porVista} />
              </div>
            ))}
          </div>
        </div>

        {n > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: movil ? 'space-between' : 'center', gap: 12, padding: movil ? '0 20px' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {orden.map((_, i) => {
                const activo = i >= pos && i < pos + porVista;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ver reseña ${i + 1} de ${n}`}
                    aria-current={activo ? 'true' : undefined}
                    onClick={() => ir(i)}
                    style={{ minWidth: 28, minHeight: TAMANO_CONTROL, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: i === pos ? 22 : 8,
                        height: 8,
                        borderRadius: 9999,
                        background: i === pos ? 'var(--cp-orange)' : activo ? 'rgba(251,244,236,0.75)' : 'rgba(251,244,236,0.25)',
                        transition: reducido ? 'none' : 'width 300ms ease, background 300ms ease',
                      }}
                    />
                  </button>
                );
              })}
            </div>
            {movil && flechas}
          </div>
        )}
      </div>
    </section>
  );
}
