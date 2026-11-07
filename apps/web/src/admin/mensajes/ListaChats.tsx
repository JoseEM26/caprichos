import React from 'react';
import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { horaListaChat } from './fechasChat';
import { MenuFilaChat } from './MenuFilaChat';
import { ChatResumen, EstadoChat, FiltroChat, RespuestaListarChats } from './mensajesTipos';
import {
  ESTADOS_BG,
  ESTADOS_LABEL,
  SIN_RESPUESTA_MIN_VISIBLE,
  esUsuarioWhatsApp,
  obtenerColorAvatar,
  obtenerEstiloEspera,
  obtenerIniciales,
} from './utilidadesChat';

export interface ListaChatsProps {
  controles?: React.ReactNode;
  conteos: RespuestaListarChats['conteos'];
  busqueda: string;
  onBuscar: (texto: string) => void;
  filtro: FiltroChat;
  onFiltro: (filtro: FiltroChat) => void;
  soloBloqueados: boolean;
  onToggleSoloBloqueados: () => void;
  cargando: boolean;
  chats: ChatResumen[];
  chatSeleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  onMarcarNoVisto?: (id: string) => void;
  onMarcarVisto?: (id: string) => void;
}

/** Chip de estado de la lista. */
function etiquetaEstado(estado: EstadoChat, urgente: boolean): string {
  return urgente ? `Urgente · ${ESTADOS_LABEL[estado]}` : ESTADOS_LABEL[estado];
}

/** Columna izquierda: buscador, filtros y una fila compacta por chat. */
export function ListaChats({
  controles,
  conteos,
  busqueda,
  onBuscar,
  filtro,
  onFiltro,
  soloBloqueados,
  onToggleSoloBloqueados,
  cargando,
  chats,
  chatSeleccionadoId,
  onSeleccionar,
  onMarcarNoVisto,
  onMarcarVisto,
}: ListaChatsProps) {
  const pendientes = conteos.atender;
  const sinVerTotal = conteos.sinVer ?? 0;
  return (
    <aside className="msg-lista" aria-label="Lista de chats">
      <div className="msg-lhead">
        <div className="msg-lhead-fila">
          <h2 className="msg-title">Chats</h2>
          {controles}
        </div>
        <span className="msg-sub">
          {pendientes === 0 ? 'Todo al día' : `${pendientes} por atender`}
          {sinVerTotal > 0 && (
            <>
              {' · '}
              <span className="msg-sin-ver-total" data-testid="total-sin-ver" role="status">
                {sinVerTotal} sin ver
              </span>
            </>
          )}
        </span>
      </div>

      <div className="msg-buscar">
        <input
          type="text"
          placeholder="Buscar un chat o un celular"
          aria-label="Buscar un chat"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
        />
      </div>

      <div className="msg-tabs">
        {[
          { id: 'todos', label: 'Todos', count: conteos.todos },
          { id: 'atender', label: 'Por atender', count: conteos.atender },
          { id: 'bot', label: 'Con el bot', count: conteos.bot },
          { id: 'novistos', label: 'No vistos', count: conteos.sinVer ?? 0 },
          { id: 'atendidos', label: 'Atendidos', count: conteos.atendidos },
        ].map((tab) => {
          const activa = filtro === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="msg-tab"
              aria-pressed={activa}
              style={{
                background: activa ? '#D9FDD3' : '#FFFFFF',
                color: activa ? '#00402F' : '#33434B',
                borderColor: activa ? '#00594A' : '#C9D2D8',
              }}
              onClick={() => onFiltro(tab.id as FiltroChat)}
            >
              {tab.label} <b>{tab.count}</b>
            </button>
          );
        })}
        {((conteos.bloqueadosSpam ?? 0) > 0 || soloBloqueados) && (
          <button
            type="button"
            className="msg-tab"
            aria-pressed={soloBloqueados}
            data-testid="filtro-bloqueados-spam"
            style={{
              background: soloBloqueados ? '#FFE0A3' : '#FFFFFF',
              color: soloBloqueados ? '#5C3700' : '#33434B',
            }}
            onClick={onToggleSoloBloqueados}
          >
            Bloqueados por spam ({conteos.bloqueadosSpam})
          </button>
        )}
      </div>

      {cargando ? (
        <div className="msg-vacio">Cargando conversaciones...</div>
      ) : chats.length === 0 ? (
        <div className="msg-vacio">No hay conversaciones en esta pestaña.</div>
      ) : (
        <ul className="msg-filas" aria-label="Conversaciones">
          {chats.map((c) => {
            const seleccionado = c.id === chatSeleccionadoId;
            const espera = typeof c.esperaMin === 'number' ? obtenerEstiloEspera(c.esperaMin) : null;
            const sinVer = c.sinLeer > 0 || Boolean(c.marcadoNoVisto);
            return (
              <li key={c.id} className="msg-li-fila">
                <button
                  type="button"
                  className="msg-fila"
                  data-sin-ver={sinVer ? '1' : '0'}
                  aria-current={seleccionado ? 'true' : undefined}
                  onClick={() => onSeleccionar(c.id)}
                >
                  <span className="msg-av" aria-hidden="true" style={{ background: obtenerColorAvatar(c.id) }}>
                    {obtenerIniciales(c.nombre)}
                  </span>
                  <span className="msg-fila-cuerpo">
                    <span className="msg-fila-l1">
                      <span className="msg-nombre">{c.nombre}</span>
                      <span className={c.sinLeer > 0 ? 'msg-hora msg-hora-nueva' : 'msg-hora'}>{c.fecha ? horaListaChat(c.fecha) : c.hora}</span>
                    </span>
                    <span className="msg-fila-l2">
                      <span className="msg-vista" title={c.ultimo}>
                        {c.ultimo}
                      </span>
                      {c.sinLeer > 0 && (
                        <span
                          className="msg-sin-leer"
                          data-testid={`sin-leer-${c.id}`}
                          role="status"
                          aria-label={`${c.sinLeer} ${c.sinLeer === 1 ? 'mensaje sin ver' : 'mensajes sin ver'}`}
                        >
                          {c.sinLeer}
                        </span>
                      )}
                    </span>
                    <span className="msg-chips">
                      {sinVer && (
                        <span className="msg-chip msg-chip-no-visto" data-testid={`no-visto-${c.id}`}>
                          <span aria-hidden="true">●</span> {c.marcadoNoVisto ? 'No visto' : 'Sin ver'}
                        </span>
                      )}
                      <span
                        className="msg-chip"
                        style={{ background: c.urgente ? '#F8C9C9' : ESTADOS_BG[c.estado] || '#EEF2F4' }}
                      >
                        {etiquetaEstado(c.estado, c.urgente)}
                      </span>
                      {esUsuarioWhatsApp(c) && (
                        <span className="msg-chip" style={{ background: '#E0F2FE', borderColor: '#BAE6FD', color: '#0C4A6E' }}>
                          Usuario de WhatsApp
                        </span>
                      )}
                      <InsigniaBloqueoSpam bloqueo={c.bloqueoSpam} id={c.id} />
                      {typeof c.sinRespuestaMin === 'number' && c.sinRespuestaMin >= SIN_RESPUESTA_MIN_VISIBLE && (
                        <span
                          data-testid={`sin-respuesta-${c.id}`}
                          className="msg-chip"
                          style={{ background: '#A3261A', borderColor: '#A3261A', color: '#FFFFFF' }}
                        >
                          Sin respuesta hace {c.sinRespuestaMin} min
                        </span>
                      )}
                      {espera && (
                        <span
                          data-testid={`espera-badge-${c.id}`}
                          className="msg-chip cv-espera-badge"
                          style={{ background: espera.fondo, border: espera.borde, color: espera.color }}
                          title={`Tiempo de espera: ${c.esperaMin} minutos`}
                        >
                          Espera: {c.esperaMin} min
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {onMarcarNoVisto && onMarcarVisto && (
                  <MenuFilaChat
                    nombre={c.nombre}
                    sinVer={sinVer}
                    onMarcarNoVisto={() => onMarcarNoVisto(c.id)}
                    onMarcarVisto={() => onMarcarVisto(c.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
