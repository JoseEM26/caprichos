import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { BotonBloquearNumero, InsigniaNumeroBloqueado } from './NumeroBloqueado';
import { horaListaChat } from './fechasChat';
import { InsigniaPos } from './InsigniaPos';
import { DetalleConversacion } from './mensajesTipos';
import { MenuChat, MenuChatProps } from './MenuChat';
import { ESTADOS_BG, ESTADOS_LABEL, esUsuarioWhatsApp, formatearNumeroReceptor, obtenerColorAvatar, obtenerIniciales } from './utilidadesChat';

export interface CabeceraChatProps {
  detalle: DetalleConversacion;
  puedeDesbloquear: boolean;
  /** Permiso mensajes/bloquear_numeros (ADMIN y SUPERVISOR). */
  puedeBloquearNumero?: boolean;
  onNumeroCambiado?: () => void | Promise<void>;
  onVolver: () => void;
  onAbrirDetalles: () => void;
  onDesbloquear: () => void;
  onAtendido?: () => void;
  onVolverPorAtender?: () => void;
  acciones: Omit<MenuChatProps, 'detalle'>;
}

/** Cabecera de una línea: nombre, teléfono, 2-3 chips de estado y el menú «⋯» con lo secundario. */
export function CabeceraChat({ detalle, puedeDesbloquear, puedeBloquearNumero, onNumeroCambiado, onVolver, onAbrirDetalles, onDesbloquear, onAtendido, onVolverPorAtender, acciones }: CabeceraChatProps) {
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
        <InsigniaPos pos={detalle.pos} id={`detalle-${detalle.id}`} enlace />
        {detalle.estado === 'atendido' && detalle.atendidoPor && (
          <span className="msg-chip" data-testid="atendido-por-detalle">
            Atendido por {detalle.atendidoPor}
            {detalle.atendidoEn ? ` · ${horaListaChat(detalle.atendidoEn)}` : ''}
          </span>
        )}
        <InsigniaBloqueoSpam bloqueo={detalle.bloqueoSpam} id={`detalle-${detalle.id}`} />
        <InsigniaNumeroBloqueado bloqueado={detalle.numeroBloqueado} propio={detalle.numeroPropio} id={`detalle-${detalle.id}`} />
        {puedeBloquearNumero && !detalle.numeroPropio && !esUsuarioWhatsApp(detalle) && (
          <BotonBloquearNumero
            telefono={detalle.telefono}
            nombre={detalle.nombre}
            bloqueado={Boolean(detalle.numeroBloqueado)}
            alCambiar={() => onNumeroCambiado?.()}
          />
        )}
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
      {detalle.estado === 'atendido'
        ? onVolverPorAtender && (
            <button type="button" className="msg-btn msg-btn-atendido" data-testid="btn-volver-por-atender" onClick={onVolverPorAtender}>
              Volver a Por atender
            </button>
          )
        : onAtendido && (
            <button type="button" className="msg-btn msg-btn-atendido" data-testid="btn-atendido" onClick={onAtendido}>
              Atendido
            </button>
          )}
      <button type="button" className="msg-btn msg-detalles" onClick={onAbrirDetalles} aria-label="Ver pedido y acciones">
        Detalles
      </button>
      <MenuChat detalle={detalle} {...acciones} />
    </header>
  );
}
