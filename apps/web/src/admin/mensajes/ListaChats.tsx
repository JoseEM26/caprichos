import React from 'react';
import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { ChatResumen, FiltroChat, RespuestaListarChats } from './mensajesTipos';
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
}

/** Columna izquierda: buscador, pestañas y filas de chats. */
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
}: ListaChatsProps) {
  return (
    <div className="cv-list">
      <div className="cv-lhead">
        <span className="cv-title">Chats</span>
        <span className="cv-sub">
          {conteos.atender === 0 ? 'Todo al día' : `${conteos.atender} por atender`}
        </span>
        {controles}
      </div>

      <div className="cv-search">
        <input
          type="text"
          placeholder="Buscar un chat o un celular"
          aria-label="Buscar un chat"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
        />
      </div>

      <div className="cv-tabs">
        {[
          { id: 'todos', label: 'Todos', count: conteos.todos },
          { id: 'atender', label: 'Por atender', count: conteos.atender },
          { id: 'bot', label: 'Con el bot', count: conteos.bot },
          { id: 'atendidos', label: 'Atendidos', count: conteos.atendidos },
        ].map((tab) => (
          <button
            key={tab.id}
            className="cv-tab"
            style={{
              background: filtro === tab.id ? '#D9FDD3' : '#F0F2F5',
              color: filtro === tab.id ? '#005C4B' : '#54656F',
            }}
            onClick={() => onFiltro(tab.id as FiltroChat)}
          >
            {tab.label} <b>{tab.count}</b>
          </button>
        ))}
        {((conteos.bloqueadosSpam ?? 0) > 0 || soloBloqueados) && (
          <button
            className="cv-tab"
            aria-pressed={soloBloqueados}
            data-testid="filtro-bloqueados-spam"
            style={{
              background: soloBloqueados ? '#FFE0A3' : '#F0F2F5',
              color: soloBloqueados ? '#7A4A00' : '#54656F',
            }}
            onClick={onToggleSoloBloqueados}
          >
            Bloqueados por spam ({conteos.bloqueadosSpam})
          </button>
        )}
      </div>

      <div className="cv-rows">
        {cargando ? (
          <div className="cv-empty">Cargando conversaciones...</div>
        ) : chats.length === 0 ? (
          <div className="cv-empty">No hay conversaciones en esta pestaña.</div>
        ) : (
          chats.map((c) => {
            const seleccionado = c.id === chatSeleccionadoId;
            const tieneSinLeer = c.sinLeer > 0;
            return (
              <button
                key={c.id}
                className="cv-row"
                style={{
                  background: seleccionado ? '#F0F2F5' : '#FFFFFF',
                }}
                onClick={() => onSeleccionar(c.id)}
              >
                <span className="cv-av" style={{ background: obtenerColorAvatar(c.id) }}>
                  {obtenerIniciales(c.nombre)}
                </span>
                <span className="cv-rb">
                  <span className="cv-r1">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <b className="cv-rn">{c.nombre}</b>
                      {esUsuarioWhatsApp(c) && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: '#E0F2FE',
                            color: '#0369A1',
                            border: '1px solid #BAE6FD',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Usuario de WhatsApp
                        </span>
                      )}
                    </span>
                    <span
                      className="cv-rt"
                      style={{ color: tieneSinLeer ? '#00A884' : '#667781' }}
                    >
                      {c.hora}
                    </span>
                  </span>
                  <span className="cv-r2">
                    <span className="cv-last">{c.ultimo}</span>
                    {tieneSinLeer && <span className="cv-badge">{c.sinLeer}</span>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      className="cv-pill"
                      style={{
                        background: c.urgente ? '#F8C9C9' : ESTADOS_BG[c.estado] || '#F0F2F5',
                      }}
                    >
                      {c.urgente ? `URGENTE · ${ESTADOS_LABEL[c.estado]}` : ESTADOS_LABEL[c.estado]}
                    </span>
                    <InsigniaBloqueoSpam bloqueo={c.bloqueoSpam} id={c.id} />
                    {typeof c.sinRespuestaMin === 'number' && c.sinRespuestaMin >= SIN_RESPUESTA_MIN_VISIBLE && (
                      <span
                        data-testid={`sin-respuesta-${c.id}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#C0392B',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Sin respuesta hace {c.sinRespuestaMin} min
                      </span>
                    )}
                    {c.esperaMin !== undefined && c.esperaMin !== null && (
                      <span
                        data-testid={`espera-badge-${c.id}`}
                        className="cv-espera-badge"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: obtenerEstiloEspera(c.esperaMin).fondo,
                          border: obtenerEstiloEspera(c.esperaMin).borde,
                          color: obtenerEstiloEspera(c.esperaMin).color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                        }}
                        title={`Tiempo de espera: ${c.esperaMin} minutos`}
                      >
                        Espera: {c.esperaMin} min
                      </span>
                    )}
                  </div>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
