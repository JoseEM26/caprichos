import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { DetalleConversacion } from './mensajesTipos';
import { MenuChat, MenuChatProps } from './MenuChat';
import { ESTADOS_BG, ESTADOS_LABEL, esUsuarioWhatsApp, formatearNumeroReceptor, obtenerColorAvatar, obtenerIniciales } from './utilidadesChat';

export interface CabeceraChatProps {
  detalle: DetalleConversacion;
  puedeDesbloquear: boolean;
  onVolver: () => void;
  onAbrirDetalles: () => void;
  onDesbloquear: () => void;
  acciones: Omit<MenuChatProps, 'detalle'>;
}

/** Cabecera de una línea: nombre, teléfono, 2-3 chips de estado y el menú «⋯» con lo secundario. */
export function CabeceraChat({ detalle, puedeDesbloquear, onVolver, onAbrirDetalles, onDesbloquear, acciones }: CabeceraChatProps) {
  const etiqueta = detalle.urgente ? `Urgente · ${ESTADOS_LABEL[detalle.estado]}` : ESTADOS_LABEL[detalle.estado];
  const textoDueno = detalle.dueno ? (detalle.esMio ? 'Lo atiendes tú' : `Lo atiende ${detalle.dueno}`) : 'Chat libre';

  return (
    <header className="msg-chead">
      <button type="button" className="msg-atras" aria-label="Volver a la lista de chats" onClick={onVolver}>
        ← Atrás
      </button>
      <span className="msg-av" aria-hidden="true" style={{ background: obtenerColorAvatar(detalle.id) }}>
        {obtenerIniciales(detalle.nombre)}
      </span>
      <div className="msg-chead-id">
        <h2 className="msg-chead-nombre" title={detalle.nombre}>
          {detalle.nombre}
        </h2>
        <span className="msg-chead-tel">
          {esUsuarioWhatsApp(detalle) ? 'Usuario de WhatsApp' : detalle.telefono}
          {detalle.modalidad ? ` · ${detalle.modalidad}` : ''}
        </span>
        {detalle.numeroReceptor && (
          <span className="msg-chead-tel">Escribió al: {formatearNumeroReceptor(detalle.numeroReceptor)}</span>
        )}
      </div>
      <div className="msg-chead-chips">
        <span className="msg-chip" style={{ background: detalle.urgente ? '#F8C9C9' : ESTADOS_BG[detalle.estado] || '#EEF2F4' }}>
          {etiqueta}
        </span>
        <span className="msg-chip">{textoDueno}</span>
        <InsigniaBloqueoSpam bloqueo={detalle.bloqueoSpam} id={`detalle-${detalle.id}`} />
        {detalle.bloqueoSpam?.activo && puedeDesbloquear && (
          <button
            type="button"
            className="msg-btn msg-btn-desbloqueo"
            data-testid="btn-desbloquear-spam"
            onClick={onDesbloquear}
          >
            Desbloquear
          </button>
        )}
      </div>
      <button type="button" className="msg-btn msg-detalles" onClick={onAbrirDetalles} aria-label="Ver pedido y acciones">
        Detalles
      </button>
      <MenuChat detalle={detalle} {...acciones} />
    </header>
  );
}
