import { useEffect, useRef, useState, type TouchEvent } from 'react';
import type { NovedadCarta } from './PaginaNovedades';
import { useEsMovil } from './useEsMovil';

interface NovedadDetalleProps {
  novedad: NovedadCarta;
  etiqueta: string;
  onCerrar: () => void;
  onVerCarta: () => void;
}

/** Distancia mínima (px) del deslizar en celular para cambiar de foto. */
const UMBRAL_DESLIZE = 40;

function formatearFecha(iso: string): string {
  const f = new Date(iso);
  return `${String(f.getUTCDate()).padStart(2, '0')}/${String(f.getUTCMonth() + 1).padStart(2, '0')}/${f.getUTCFullYear()}`;
}

function textoEnlace(url: string): string {
  if (url.includes('tiktok')) return 'Ver en TikTok';
  if (url.includes('instagram')) return 'Ver en Instagram';
  return 'Ver más';
}

const BOTON_PRINCIPAL = {
  minHeight: 48,
  padding: '0 20px',
  boxSizing: 'border-box' as const,
  border: 0,
  borderRadius: 12,
  background: 'var(--cp-orange)',
  color: 'var(--cp-navy)',
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
};

const FLECHA = {
  position: 'absolute' as const,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: 22,
  border: 0,
  background: 'rgba(255,255,255,0.16)',
  color: '#FFFFFF',
  fontSize: 22,
  fontWeight: 800,
  cursor: 'pointer',
};

/** Ventana de detalle de una novedad: galería con anterior/siguiente, video, fecha, texto y botón. */
export function NovedadDetalle({ novedad, etiqueta, onCerrar, onVerCarta }: NovedadDetalleProps) {
  const movil = useEsMovil();
  const fotos = (novedad.fotos || []).filter((f) => f.url);
  const total = fotos.length;
  const [indice, setIndice] = useState(0);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const toqueX = useRef<number | null>(null);

  const tipoUp = (novedad.tipo || '').toUpperCase();
  const esPromo = tipoUp === 'PROMOCION' || tipoUp === 'PROMO' || tipoUp === 'BANNER';
  const esVideoDirecto = !!novedad.video_url && /\.(mp4|webm)(\?|$)/i.test(novedad.video_url);
  const tieneEnlace = !!novedad.video_url && !esVideoDirecto;
  const foto = fotos[indice]?.url;

  const mover = (d: number) => {
    if (total < 2) return;
    setIndice((i) => (i + d + total) % total);
  };

  const irCarta = () => {
    onCerrar();
    onVerCarta();
  };

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botonCerrar.current?.focus();
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', alPresionar);
    return () => {
      window.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [total]);

  const alTocar = (e: TouchEvent) => {
    toqueX.current = e.touches[0].clientX;
  };
  const alSoltar = (e: TouchEvent) => {
    if (toqueX.current === null) return;
    const dx = e.changedTouches[0].clientX - toqueX.current;
    toqueX.current = null;
    if (Math.abs(dx) > UMBRAL_DESLIZE) mover(dx < 0 ? 1 : -1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={novedad.titulo}
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(11, 44, 62, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: movil ? 0 : 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={alTocar}
        onTouchEnd={alSoltar}
        style={{
          width: '100%',
          maxWidth: movil ? '100%' : 960,
          height: movil ? '100%' : 'auto',
          maxHeight: movil ? '100%' : '92vh',
          background: 'var(--cp-white)',
          color: 'var(--cp-navy)',
          borderRadius: movil ? 0 : 24,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <span
            style={{
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
            {etiqueta}
          </span>
          <span style={{ flex: 1 }} />
          <button
            ref={botonCerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              width: 44,
              height: 44,
              border: 0,
              borderRadius: 22,
              background: 'var(--cp-cream)',
              color: 'var(--cp-navy)',
              fontSize: 22,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            position: 'relative',
            flex: movil ? '1 1 auto' : 'none',
            minHeight: movil ? 0 : 240,
            aspectRatio: movil ? undefined : '16 / 10',
            background: 'var(--cp-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {esVideoDirecto ? (
            <video src={novedad.video_url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : foto ? (
            <img src={foto} alt={novedad.titulo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--cp-cream)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.6 }}>
              <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
          )}
          {total > 1 && (
            <>
              <button onClick={() => mover(-1)} aria-label="Anterior" style={{ ...FLECHA, left: 10 }}>‹</button>
              <button onClick={() => mover(1)} aria-label="Siguiente" style={{ ...FLECHA, right: 10 }}>›</button>
              <span aria-live="polite" style={{ position: 'absolute', right: 12, bottom: 10, background: 'rgba(11,44,62,0.7)', color: '#FFFFFF', borderRadius: 9999, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>
                {indice + 1} / {total}
              </span>
            </>
          )}
        </div>

        <div style={{ padding: movil ? '16px 16px 24px' : '20px 24px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: movil ? 21 : 27, lineHeight: 1.2 }}>
            {novedad.titulo}
          </h2>
          {novedad.evento_fecha && (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-rust)' }}>
              {formatearFecha(novedad.evento_fecha)}
              {novedad.evento_lugar ? ` · ${novedad.evento_lugar}` : ''}
            </span>
          )}
          {novedad.texto && (
            <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', whiteSpace: 'pre-line' }}>{novedad.texto}</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {tieneEnlace && (
              <a href={novedad.video_url} target="_blank" rel="noopener noreferrer" style={BOTON_PRINCIPAL}>
                {textoEnlace(novedad.video_url!)}
              </a>
            )}
            {!tieneEnlace && (
              <button onClick={irCarta} style={BOTON_PRINCIPAL}>
                {esPromo ? 'Pedir ahora' : 'Ver la carta'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
