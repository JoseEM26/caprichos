import { IconoLapiz } from './ModalEditarNombre';
import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { DetalleConversacion } from './mensajesTipos';
import { ESTADOS_BG, ESTADOS_LABEL, esUsuarioWhatsApp, obtenerColorAvatar, obtenerIniciales } from './utilidadesChat';

export interface CabeceraChatProps {
  detalle: DetalleConversacion;
  puedeDesbloquear: boolean;
  onVolver: () => void;
  onEditarNombre: () => void;
  onDesbloquear: () => void;
}

/** Cabecera de la conversación: volver (móvil), nombre, teléfono, estado y spam. */
export function CabeceraChat({ detalle, puedeDesbloquear, onVolver, onEditarNombre, onDesbloquear }: CabeceraChatProps) {
  return (
    <div className="cv-chead">
      <button className="cv-back" aria-label="Volver a la lista de chats" onClick={onVolver}>
        ←
      </button>
      <span className="cv-av" style={{ background: obtenerColorAvatar(detalle.id) }}>
        {obtenerIniciales(detalle.nombre)}
      </span>
      <span className="cv-hb">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <b className="cv-hn">{detalle.nombre}</b>
          {esUsuarioWhatsApp(detalle) && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#E0F2FE',
                color: '#0369A1',
                border: '1px solid #BAE6FD',
              }}
            >
              Usuario de WhatsApp
            </span>
          )}
          <button
            type="button"
            onClick={onEditarNombre}
            title="Editar nombre"
            aria-label="Editar nombre"
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--cp-line, #CBD5E1)',
              borderRadius: '6px',
              padding: '2px 8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            <IconoLapiz tamano={13} />
            <span>Editar nombre</span>
          </button>
        </span>
        <span className="cv-hs">
          {esUsuarioWhatsApp(detalle) ? 'Usuario de WhatsApp' : detalle.telefono}
          {detalle.modalidad ? ` · ${detalle.modalidad}` : ''}
        </span>
      </span>
      <span
        className="cv-pill"
        style={{
          background: detalle.urgente ? '#F8C9C9' : ESTADOS_BG[detalle.estado] || '#F0F2F5',
        }}
      >
        {detalle.urgente ? `URGENTE · ${ESTADOS_LABEL[detalle.estado]}` : ESTADOS_LABEL[detalle.estado]}
      </span>
      <InsigniaBloqueoSpam bloqueo={detalle.bloqueoSpam} id={`detalle-${detalle.id}`} />
      {detalle.bloqueoSpam?.activo && puedeDesbloquear && (
        <button
          type="button"
          data-testid="btn-desbloquear-spam"
          onClick={onDesbloquear}
          style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid #B45309', background: '#FFFFFF', color: '#B45309', fontWeight: 700, cursor: 'pointer' }}
        >
          Desbloquear
        </button>
      )}
    </div>
  );
}
