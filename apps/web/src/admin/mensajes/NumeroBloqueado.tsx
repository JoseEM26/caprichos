import { useState } from 'react';
import { bloquearNumero, desbloquearNumero } from './mensajesApi';

/** Insignia con texto (no solo color): «Número bloqueado» o «Número del negocio» (nada se le envía). */
export function InsigniaNumeroBloqueado({ bloqueado, propio, id }: { bloqueado?: boolean; propio?: boolean; id: string }) {
  if (!bloqueado && !propio) return null;
  return (
    <span
      data-testid={`numero-bloqueado-${id}`}
      className="cv-pill"
      style={{ background: '#F6D5CB', color: '#7A2E0A', border: '1px solid #B2500F' }}
    >
      {propio ? 'Número del negocio: no se le envía nada' : 'Número bloqueado'}
    </span>
  );
}

const boton = (activo: boolean) => ({
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: activo ? 'pointer' : 'not-allowed',
});

/** Botón «Bloquear este número» / «Desbloquear» con confirmación Sí/No y motivo opcional (máx. 120). */
export function BotonBloquearNumero({
  telefono,
  nombre,
  bloqueado,
  alCambiar,
}: {
  telefono: string;
  nombre: string;
  bloqueado: boolean;
  alCambiar: () => void | Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setMotivo('');
    setError(null);
    setEnviando(false);
  };

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      if (bloqueado) await desbloquearNumero(telefono);
      else await bloquearNumero(telefono, motivo.trim());
      cerrar();
      await alCambiar();
    } catch (err: any) {
      setError(err?.message || 'No se pudo completar la acción.');
      setEnviando(false);
    }
  };

  return (
    <>
      <button type="button" className="msg-btn msg-btn-desbloqueo" data-testid="btn-bloquear-numero" onClick={() => setAbierto(true)} style={{ minHeight: 44 }}>
        {bloqueado ? 'Desbloquear número' : '🚫 Bloquear este número'}
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={bloqueado ? 'Desbloquear número' : 'Bloquear número'}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div style={{ background: '#FFFFFF', color: '#0B2C3E', borderRadius: 12, padding: 24, maxWidth: 440, width: '90%' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>
              {bloqueado ? `¿Desbloquear el número de ${nombre}?` : `¿Bloquear el número de ${nombre}?`}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#2C4C5D' }}>
              {bloqueado
                ? 'Volverá a recibir avisos y el bot volverá a responderle.'
                : 'No se le enviará nada por WhatsApp (ni avisos de pedido ni mensajes manuales) y se ignorarán sus mensajes: el bot no le responde. Puedes desbloquearlo cuando quieras.'}
            </p>
            {!bloqueado && (
              <textarea
                aria-label="Motivo del bloqueo (opcional)"
                placeholder="Motivo (opcional)"
                rows={2}
                maxLength={120}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E3D6C6', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
              />
            )}
            {error && (
              <div role="alert" style={{ color: '#B2500F', fontSize: 13, marginTop: 6 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={cerrar} disabled={enviando} style={{ ...boton(true), background: 'transparent', border: '1px solid #2C4C5D', color: '#0B2C3E' }}>
                No, cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={enviando} style={{ ...boton(!enviando), background: '#B2500F', color: '#FFFFFF', border: 'none' }}>
                {enviando ? 'Un momento...' : bloqueado ? 'Sí, desbloquear' : 'Sí, bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
