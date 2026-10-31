import { useEffect, useState } from 'react';
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
}

const INTERVALO_MS = 6000;
const LARGO_TEXTO = 220;
const TAMANO_CONTROL = 44;

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
function FotoAutor({ nombre, url }: { nombre: string; url: string | null }) {
  const [fallo, setFallo] = useState(false);
  const estilo = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    flexShrink: 0,
  } as const;
  if (!url || fallo) {
    return (
      <span
        aria-hidden="true"
        style={{ ...estilo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800 }}
      >
        {(nombre.trim().charAt(0) || '?').toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      style={{ ...estilo, objectFit: 'cover' }}
    />
  );
}

/** Carrusel de reseñas buenas de Google Maps, justo antes de «Deja tu opinión». Sin reseñas, no se muestra nada. */
export function CarruselResenas() {
  const movil = useEsMovil();
  const [datos, setDatos] = useState<RespuestaResenasCarta | null>(null);
  const [orden, setOrden] = useState<ResenaCarta[]>([]);
  const [idx, setIdx] = useState(0);
  const [conRaton, setConRaton] = useState(false);
  const [conFoco, setConFoco] = useState(false);
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
  const pausado = conRaton || conFoco;

  useEffect(() => {
    if (n < 2 || pausado || reducido) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), INTERVALO_MS);
    return () => clearInterval(t);
  }, [n, pausado, reducido, idx]);

  if (!datos || n === 0) return null;

  const r = orden[Math.min(idx, n - 1)];
  const estrellas = Math.max(0, Math.min(5, Math.round(r.estrellas)));
  const fecha = mesYAnio(r.fecha);
  const total = datos.resumen?.total ?? 0;
  const control = {
    minWidth: TAMANO_CONTROL,
    minHeight: TAMANO_CONTROL,
    borderRadius: 9999,
    border: '1.5px solid var(--cp-navy)',
    background: 'transparent',
    color: 'var(--cp-navy)',
    fontWeight: 800,
    cursor: 'pointer',
  } as const;

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
      style={{ maxWidth: 1200, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '28px 16px 0' : '48px 24px 0' }}
    >
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: movil ? 16 : 20,
          padding: movil ? '16px' : '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em', color: 'var(--cp-rust)' }}>
            LO QUE DICEN EN GOOGLE
          </span>
          {datos.resumen && (
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--cp-navy)' }}>
              {`${datos.resumen.rating} en Google · ${total} ${total === 1 ? 'reseña' : 'reseñas'}`}
            </span>
          )}
        </div>

        <article key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 150 }}>
          <span role="img" aria-label={`${estrellas} de 5 estrellas`} style={{ color: 'var(--cp-orange)', fontSize: 18, letterSpacing: 2 }}>
            {'★'.repeat(estrellas)}
            <span style={{ color: 'var(--cp-line)' }}>{'★'.repeat(5 - estrellas)}</span>
          </span>
          <p style={{ margin: 0, fontSize: movil ? 15 : 16, lineHeight: '24px', color: 'var(--cp-navy)' }}>{recortarTexto(r.texto)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FotoAutor nombre={r.autor} url={r.foto} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--cp-navy)' }}>{r.autor}</span>
              <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                {fecha ? `${fecha} · ` : ''}Reseña de Google
              </span>
            </div>
            {r.enlace && (
              <a
                href={r.enlace}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 'auto', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 13, minHeight: TAMANO_CONTROL, display: 'inline-flex', alignItems: 'center' }}
              >
                Ver en Google Maps
              </a>
            )}
          </div>
        </article>

        {n > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label="Reseña anterior"
              style={control}
              onClick={() => setIdx((i) => (i - 1 + n) % n)}
            >
              ‹
            </button>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {orden.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ver reseña ${i + 1} de ${n}`}
                  aria-current={i === idx ? 'true' : undefined}
                  onClick={() => setIdx(i)}
                  style={{ minWidth: TAMANO_CONTROL, minHeight: TAMANO_CONTROL, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 10, height: 10, borderRadius: '50%', background: i === idx ? 'var(--cp-navy)' : 'var(--cp-line)' }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Reseña siguiente"
              style={control}
              onClick={() => setIdx((i) => (i + 1) % n)}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
