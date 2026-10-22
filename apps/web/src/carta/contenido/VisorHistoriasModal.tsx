import { useState, useEffect } from 'react';

export interface HistoriaCírculo {
  id: string;
  titulo: string;
  portada_url?: string | null;
  fotos: Array<{ id: string; url: string; pie?: string }>;
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

  const historiaActual = historias[destIdx];
  const fotoActual = historiaActual?.fotos?.[fotoIdx];

  // Cerrar con Escape
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [destIdx, fotoIdx]);

  const siguiente = () => {
    if (!historiaActual) return;
    if (fotoIdx < historiaActual.fotos.length - 1) {
      setFotoIdx(fotoIdx + 1);
    } else if (destIdx < historias.length - 1) {
      setDestIdx(destIdx + 1);
      setFotoIdx(0);
    } else {
      onCerrar();
    }
  };

  const anterior = () => {
    if (fotoIdx > 0) {
      setFotoIdx(fotoIdx - 1);
    } else if (destIdx > 0) {
      setDestIdx(destIdx - 1);
      setFotoIdx(historias[destIdx - 1].fotos.length - 1);
    }
  };

  if (!historiaActual || !fotoActual) return null;

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
      {/* Barras de progreso de historias */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 6px' }}>
        {historiaActual.fotos.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden', display: 'block' }}>
            <span style={{ display: 'block', height: 3, background: '#FFFFFF', width: i <= fotoIdx ? '100%' : '0%' }} />
          </span>
        ))}
      </div>

      {/* Cabecera del visor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 8px' }}>
        <span style={{ width: 36, height: 36, borderRadius: 18, border: '2px solid var(--cp-orange)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}>
          {historiaActual.portada_url && <img src={historiaActual.portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </span>
        <span style={{ flex: 1, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>
          {historiaActual.titulo}
        </span>
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          style={{ width: 44, height: 44, border: 0, borderRadius: 22, background: 'rgba(255,255,255,0.14)', color: '#FFFFFF', fontSize: 22, fontWeight: 800, cursor: 'pointer' }}
        >
          ×
        </button>
      </div>

      {/* Foto y zonas táctiles para avanzar/retroceder */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={fotoActual.url}
          alt={fotoActual.pie || historiaActual.titulo}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
        <button onClick={anterior} aria-label="Anterior" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', border: 0, background: 'transparent', cursor: 'pointer' }} />
        <button onClick={siguiente} aria-label="Siguiente" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%', border: 0, background: 'transparent', cursor: 'pointer' }} />
      </div>

      {/* Pie de foto */}
      {fotoActual.pie && (
        <div style={{ padding: '10px 16px calc(14px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: 15, lineHeight: '21px', fontWeight: 600 }}>
            {fotoActual.pie}
          </span>
        </div>
      )}
    </div>
  );
}
