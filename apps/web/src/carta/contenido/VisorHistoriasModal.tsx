import { useState, useEffect } from 'react';

export interface HistoriaCírculo {
  id: string;
  titulo: string;
  portada_url?: string | null;
  activo?: boolean;
  fotos: Array<{ id: string; url: string; pie?: string }>;
}

export function extraerPieDeUrl(url?: string | null): string {
  if (!url) return '';
  const idx = url.indexOf('#');
  if (idx < 0) return '';
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get('pie') || '';
}

export function extraerOffDeUrl(url?: string | null): boolean {
  if (!url) return false;
  const idx = url.indexOf('#');
  if (idx < 0) return false;
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get('off') === '1';
}

export function limpiarUrlFoto(url?: string | null): string {
  if (!url) return '';
  return url.split('#')[0];
}

interface VisorHistoriasModalProps {
  historias: HistoriaCírculo[];
  destacadaIdxInicial: number;
  onCerrar: () => void;
}

export function VisorHistoriasModal({
  historias,
  destacadaIdxInicial,
  onCerrar,
}: VisorHistoriasModalProps) {
  const [destIdx, setDestIdx] = useState(destacadaIdxInicial);
  const [fotoIdx, setFotoIdx] = useState(0);

  useEffect(() => {
    setDestIdx(destacadaIdxInicial);
    setFotoIdx(0);
  }, [destacadaIdxInicial]);

  const historiaActual = historias[destIdx];
  const fotos = historiaActual?.fotos ?? [];
  const fotoActual = fotos[fotoIdx];

  const avanzarPaso = (d: number) => {
    if (!historiaActual) return;
    const k = Math.max(0, fotoIdx + d);
    if (k >= fotos.length) {
      onCerrar();
      return;
    }
    setFotoIdx(k);
  };

  // Avance automático cada 4.5s igual que en Main.dc.html (openViewer / vwStep)
  useEffect(() => {
    if (!historiaActual || !fotoActual) return;
    const timer = window.setTimeout(() => {
      avanzarPaso(1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [destIdx, fotoIdx, historiaActual, fotoActual]);

  // Cerrar con Escape y navegar con flechas
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') avanzarPaso(1);
      if (e.key === 'ArrowLeft') avanzarPaso(-1);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [destIdx, fotoIdx]);

  if (!historiaActual || !fotoActual) return null;

  const vwCover = historiaActual.portada_url || fotos[0]?.url || '';
  const vwCap = fotoActual.pie ?? extraerPieDeUrl(fotoActual.url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={historiaActual.titulo}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 110,
        background: '#0B0F12',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes cp-progA { from { width: 0; } to { width: 100%; } }
        @keyframes cp-progB { from { width: 0; } to { width: 100%; } }
      `}</style>

      {/* Barras de progreso de historias */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 6px' }}>
        {fotos.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.3)',
              overflow: 'hidden',
              display: 'block',
            }}
          >
            <span
              style={{
                display: 'block',
                height: 3,
                background: '#FFFFFF',
                width: i < fotoIdx ? '100%' : '0',
                animation:
                  i === fotoIdx
                    ? `cp-prog${fotoIdx % 2 ? 'B' : 'A'} 4.5s linear forwards`
                    : 'none',
              }}
            />
          </span>
        ))}
      </div>

      {/* Cabecera del visor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 8px' }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: '2px solid var(--cp-orange)',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flex: 'none',
          }}
        >
          {vwCover && (
            <img
              src={vwCover}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </span>
        <span
          style={{
            flex: 1,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {historiaActual.titulo}
        </span>
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          style={{
            width: 44,
            height: 44,
            border: 0,
            borderRadius: 22,
            background: 'rgba(255,255,255,0.14)',
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {/* Foto y zonas táctiles para avanzar/retroceder */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {fotoActual.url ? (
          <img
            src={fotoActual.url}
            alt={vwCap}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              color: 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              padding: 24,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="56"
              height="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h4l2-3h6l2 3h4v11H3z"></path>
              <circle cx="12" cy="13.5" r="3.5"></circle>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em' }}>
              FOTO DEL CLIENTE (EJEMPLO)
            </span>
          </div>
        )}
        <button
          onClick={() => avanzarPaso(-1)}
          aria-label="Anterior"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '38%',
            border: 0,
            background: 'transparent',
            color: 'transparent',
            cursor: 'pointer',
          }}
        />
        <button
          onClick={() => avanzarPaso(1)}
          aria-label="Siguiente"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '62%',
            border: 0,
            background: 'transparent',
            color: 'transparent',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Pie de foto */}
      <div
        style={{
          padding: '10px 16px calc(14px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {vwCap && <span style={{ fontSize: 15, lineHeight: '21px', fontWeight: 600 }}>{vwCap}</span>}
      </div>
    </div>
  );
}
