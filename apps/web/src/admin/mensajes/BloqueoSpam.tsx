import { useState } from 'react';
import type { BloqueoSpam } from './mensajesTipos';

/** «hasta 15:40» en hora de Lima; vacío si no hay fecha. */
export function horaHasta(hastaEn: string | null | undefined): string {
  if (!hastaEn) return '';
  const d = new Date(hastaEn);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d);
}

/** Insignia ámbar «Bloqueado por spam · hasta 15:40»; no sale si el bloqueo no está activo o ya venció. */
export function InsigniaBloqueoSpam({ bloqueo, id }: { bloqueo?: BloqueoSpam | null; id: string }) {
  if (!bloqueo?.activo) return null;
  if (bloqueo.hastaEn && new Date(bloqueo.hastaEn).getTime() <= Date.now()) return null;
  const h = horaHasta(bloqueo.hastaEn);
  return (
    <span
      data-testid={`bloqueo-spam-${id}`}
      className="cv-pill"
      style={{ background: '#FFE0A3', color: '#7A4A00', border: '1px solid #E9A93B' }}
    >
      Bloqueado por spam{h ? ` · hasta ${h}` : ''}
      {bloqueo.reincidente ? ' · reincidente' : ''}
    </span>
  );
}

/**
 * Ventana de desbloqueo: motivo obligatorio (mínimo 5 caracteres) y confirmación Sí/No.
 * No usa window.confirm: la confirmación es parte de la ventana.
 */
export function ModalDesbloquearSpam({
  nombre,
  alConfirmar,
  alCancelar,
}: {
  nombre: string;
  alConfirmar: (motivo: string) => Promise<void>;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = motivo.trim().length >= 5;

  const confirmar = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar(motivo.trim());
    } catch (err: any) {
      setError(err?.message || 'No se pudo desbloquear el chat.');
      setEnviando(false);
    }
  };

  const boton = (activo: boolean) => ({
    minHeight: 44,
    padding: '0 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: activo ? 'pointer' : 'not-allowed',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Desbloquear chat"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 24, maxWidth: 440, width: '90%' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>¿Desbloquear el chat de {nombre}?</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#64748B' }}>
          El bot volverá a responderle. Escribe el motivo (mínimo 5 caracteres); queda registrado.
        </p>
        <textarea
          aria-label="Motivo del desbloqueo"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
        />
        {error && (
          <div role="alert" style={{ color: '#DC2626', fontSize: 13, marginTop: 6 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={alCancelar} disabled={enviando} style={{ ...boton(true), background: 'transparent', border: '1px solid #CBD5E1', color: '#475569' }}>
            No, cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!valido || enviando}
            style={{ ...boton(valido && !enviando), background: '#B45309', color: '#FFFFFF', border: 'none', opacity: valido && !enviando ? 1 : 0.6 }}
          >
            {enviando ? 'Desbloqueando...' : 'Sí, desbloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
