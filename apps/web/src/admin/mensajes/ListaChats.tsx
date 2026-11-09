import React from 'react';
import { InsigniaBloqueoSpam } from './BloqueoSpam';
import { horaListaChat } from './fechasChat';
import { diaDeChat, encabezadoDia, FiltroDia, textoVacioDia } from './diasBandeja';
import { MenuFilaChat } from './MenuFilaChat';
import { InsigniaPos } from './InsigniaPos';
import { ChatResumen, EstadoChat, FiltroChat, FiltroPos, RespuestaListarChats } from './mensajesTipos';
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
  /** Filtro del punto de venta (opcional): faltan procesar / ya procesados. */
  pos?: FiltroPos | null;
  onPos?: (pos: FiltroPos | null) => void;
  soloBloqueados: boolean;
  onToggleSoloBloqueados: () => void;
  cargando: boolean;
  chats: ChatResumen[];
  chatSeleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  onMarcarNoVisto?: (id: string) => void;
  onMarcarVisto?: (id: string) => void;
  /** Check de cada fila: marca el chat como atendido sin abrirlo. */
  onAtendido?: (id: string, nombre: string) => void;
  /** En «Atendidos», el mismo botón devuelve el chat a «Por atender». */
  onVolverPorAtender?: (id: string, nombre: string) => void;
  /** Filtro por día (solo cuando la pestaña tiene chats de días anteriores). */
  dia?: FiltroDia;
  onDia?: (dia: FiltroDia) => void;
  dias?: { hoy: number; ayer: number; manana: number; anteriores: number; total: number } | null;
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
  pos = null,
  onPos,
  soloBloqueados,
  onToggleSoloBloqueados,
  cargando,
  chats,
  chatSeleccionadoId,
  onSeleccionar,
  onMarcarNoVisto,
  onMarcarVisto,
  onAtendido,
  onVolverPorAtender,
  dia = 'todos',
  onDia,
  dias = null,
}: ListaChatsProps) {
  const pendientes = conteos.atender;
  const sinVerTotal = conteos.sinVer ?? 0;
  const [panelAbierto, setPanelAbierto] = React.useState(false);
  const cabRef = React.useRef<HTMLDivElement>(null);
  const botonFiltrosRef = React.useRef<HTMLButtonElement>(null);
  const pestanasRef = React.useRef<HTMLDivElement>(null);
  // Con mouse la rueda solo mueve en vertical: sobre las pestañas la convertimos en desplazamiento lateral (solo si hay desborde)
  React.useEffect(() => {
    const el = pestanasRef.current;
    if (!el) return;
    const alRodar = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', alRodar, { passive: false });
    return () => el.removeEventListener('wheel', alRodar);
  }, []);
  const hayDias = Boolean(dias && onDia);
  const diaActivo = hayDias && dia !== 'hoy';
  const posActivo = Boolean(onPos) && pos !== null;
  const nFiltros = (diaActivo ? 1 : 0) + (posActivo ? 1 : 0);
  const textoDia = (d: FiltroDia) =>
    d === 'hoy' ? 'Hoy' : d === 'ayer' ? 'Ayer' : d === 'manana' ? 'Mañana' : d === 'todos' ? 'Todos' : d.split('-').reverse().join('/');
  const textoPos = pos === 'faltan' ? 'faltan procesar' : 'ya procesados';

  // Cierra con Escape (devuelve el foco al botón) y al tocar fuera del encabezado.
  React.useEffect(() => {
    if (!panelAbierto) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelAbierto(false);
        botonFiltrosRef.current?.focus();
      }
    };
    const alTocar = (e: Event) => {
      if (cabRef.current && !cabRef.current.contains(e.target as Node)) setPanelAbierto(false);
    };
    document.addEventListener('keydown', alTeclado);
    document.addEventListener('mousedown', alTocar);
    document.addEventListener('touchstart', alTocar);
    return () => {
      document.removeEventListener('keydown', alTeclado);
      document.removeEventListener('mousedown', alTocar);
      document.removeEventListener('touchstart', alTocar);
    };
  }, [panelAbierto]);

  const limpiarFiltros = () => {
    if (onDia) onDia('hoy');
    if (onPos) onPos(null);
  };
  const hayFiltros = hayDias || Boolean(onPos);

  return (
    <aside className="msg-lista" aria-label="Lista de chats">
      <div className="msg-cab" ref={cabRef} data-testid="cabecera-compacta">
        <div className="msg-cab-fila">
          <h2 className="msg-title msg-solo-lectores">Chats</h2>
          <div className="msg-cab-controles">{controles}</div>
          {hayFiltros && (
            <button
              ref={botonFiltrosRef}
              type="button"
              className="msg-filtros-btn"
              data-testid="boton-filtros"
              aria-expanded={panelAbierto}
              aria-controls="msg-panel-filtros"
              aria-label={nFiltros > 0 ? `Filtros, ${nFiltros} ${nFiltros === 1 ? 'activo' : 'activos'}` : 'Filtros'}
              onClick={() => setPanelAbierto((v) => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span>Filtros</span>
              {nFiltros > 0 && (
                <span className="msg-filtros-badge" data-testid="badge-filtros" aria-hidden="true">
                  {nFiltros}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="msg-buscar">
          <input
            type="text"
            placeholder="Buscar un chat o un celular"
            aria-label="Buscar un chat"
            value={busqueda}
            onChange={(e) => onBuscar(e.target.value)}
          />
          <span className="msg-sub" data-al-dia={pendientes === 0 ? '1' : '0'}>
            <span className="msg-punto" aria-hidden="true" />
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

        {panelAbierto && hayFiltros && (
          <div className="msg-panel-filtros" id="msg-panel-filtros" role="group" aria-label="Filtros de la bandeja" data-testid="panel-filtros">
            {dias && onDia && (
              <section className="msg-panel-sec">
                <h3>Día</h3>
                <div className="msg-panel-chips" role="group" aria-label="Filtrar por día">
                  {(
                    [
                      ['hoy', 'Hoy', dias.hoy],
                      ['ayer', 'Ayer', dias.ayer],
                      ['manana', 'Mañana', dias.manana],
                      ['todos', 'Todos', dias.total],
                    ] as const
                  ).map(([id, label, n]) => (
                    <button
                      key={id}
                      type="button"
                      className="msg-tab msg-tab-dia"
                      aria-pressed={dia === id}
                      aria-label={`${label}: ${n} ${n === 1 ? 'chat' : 'chats'}`}
                      onClick={() => onDia(id)}
                    >
                      {label} <b>{n}</b>
                    </button>
                  ))}
                  <input
                    type="date"
                    className="msg-dia-fecha"
                    aria-label="Elegir fecha"
                    title="Elegir fecha"
                    value={/^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : ''}
                    onChange={(e) => onDia(e.target.value || 'todos')}
                  />
                </div>
              </section>
            )}
            {onPos && (
              <section className="msg-panel-sec">
                <h3>Punto de venta</h3>
                <div className="msg-panel-chips" role="group" aria-label="Punto de venta">
                  {([
                    ['faltan', `Faltan procesar${conteos.faltanProcesar ? ` (${conteos.faltanProcesar})` : ''}`],
                    ['procesados', 'Ya procesados'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="msg-tab"
                      aria-pressed={pos === id}
                      onClick={() => onPos(pos === id ? null : id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <button type="button" className="msg-link msg-limpiar" data-testid="limpiar-filtros" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div ref={pestanasRef} className="msg-tabs" role="group" aria-label="Filtrar chats" data-testid="pestanas">
        {[
          { id: 'todos', label: 'Todos', count: conteos.todos },
          { id: 'atender', label: 'Por atender', count: conteos.atender },
          { id: 'bot', label: 'Con el bot', count: conteos.bot },
          { id: 'novistos', label: 'No vistos', count: conteos.sinVer ?? 0 },
          { id: 'atendidos', label: 'Atendidos', count: conteos.atendidos },
          ...((conteos.reprogramar ?? 0) > 0 || filtro === 'reprogramar'
            ? [{ id: 'reprogramar', label: 'Por reprogramar', count: conteos.reprogramar ?? 0 }]
            : []),
        ].map((tab) => {
          const activa = filtro === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="msg-tab msg-tab-principal"
              aria-pressed={activa}
              data-pendiente={tab.id === 'atender' && tab.count > 0 ? '1' : '0'}
              onClick={() => onFiltro(tab.id as FiltroChat)}
            >
              {tab.label} <b>{tab.count}</b>
            </button>
          );
        })}
        {((conteos.bloqueadosSpam ?? 0) > 0 || soloBloqueados) && (
          <button
            type="button"
            className="msg-tab msg-tab-principal msg-tab-spam"
            aria-pressed={soloBloqueados}
            data-testid="filtro-bloqueados-spam"
            onClick={onToggleSoloBloqueados}
          >
            Bloqueados por spam ({conteos.bloqueadosSpam})
          </button>
        )}
      </div>

      {(diaActivo || posActivo) && (
        <div className="msg-activos" data-testid="filtros-activos" aria-label="Filtros activos">
          {diaActivo && (
            <button type="button" className="msg-chip-activo" aria-label={`Quitar filtro Día: ${textoDia(dia)}`} onClick={() => onDia?.('hoy')}>
              Día: {textoDia(dia)} <span aria-hidden="true">✕</span>
            </button>
          )}
          {posActivo && (
            <button type="button" className="msg-chip-activo" aria-label={`Quitar filtro POS: ${textoPos}`} onClick={() => onPos?.(null)}>
              POS: {textoPos} <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
      )}
      {dias && onDia && dia === 'hoy' && dias.anteriores > 0 && (
        <button type="button" className="msg-aviso-anteriores" data-testid="aviso-anteriores" onClick={() => onDia('todos')}>
          {dias.anteriores} de días anteriores {filtro === 'atendidos' ? 'archivados' : 'sin atender'} · Ver
        </button>
      )}

      {cargando ? (
        <div className="msg-vacio">Cargando conversaciones...</div>
      ) : chats.length === 0 ? (
        <div className="msg-vacio" data-testid="vacio-lista">
          {dias && onDia && dia !== 'todos' && dia !== 'hoy' && !busqueda
            ? `${textoVacioDia(dia)}.`
            : filtro === 'atender' && !busqueda
              ? 'Todo al día: no hay chats por atender.'
              : 'No hay conversaciones en esta pestaña.'}
          {dias && onDia && dia !== 'hoy' && dia !== 'todos' && (
            <>
              {' '}
              <button type="button" className="msg-link" data-testid="volver-hoy" onClick={() => onDia('hoy')}>
                Volver a Hoy
              </button>
            </>
          )}
          {dias && onDia && dia !== 'todos' && dias.total > 0 && (
            <>
              {' '}
              <button type="button" className="msg-link" onClick={() => onDia('todos')}>
                Ver todos los días ({dias.total})
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="msg-filas" aria-label="Conversaciones">
          {chats.map((c, i) => {
            const diaFila = dias ? diaDeChat(c) : '';
            const nuevoDia = dias && (i === 0 || diaDeChat(chats[i - 1]) !== diaFila);
            const seleccionado = c.id === chatSeleccionadoId;
            const espera = typeof c.esperaMin === 'number' ? obtenerEstiloEspera(c.esperaMin) : null;
            const sinVer = c.sinLeer > 0 || Boolean(c.marcadoNoVisto);
            return (
              <React.Fragment key={c.id}>
              {nuevoDia && (
                <li className="msg-encabezado-dia" role="presentation" data-testid={`dia-${diaFila}`}>
                  {encabezadoDia(diaFila)} · {chats.filter((x) => diaDeChat(x) === diaFila).length}
                </li>
              )}
              <li className="msg-li-fila">
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
                      {c.volvioAEscribir && (
                        <span className="msg-chip msg-chip-no-visto" data-testid={`volvio-${c.id}`}>
                          Volvió a escribir
                        </span>
                      )}
                      {c.porReprogramar && (
                        <span className="msg-chip" data-testid={`reprogramar-${c.id}`}>
                          Entrega por reprogramar
                        </span>
                      )}
                      <InsigniaPos pos={c.pos} id={c.id} />
                      {c.estado === 'atendido' && c.atendidoPor && (
                        <span className="msg-chip" data-testid={`atendido-por-${c.id}`}>
                          Atendido por {c.atendidoPor}
                          {c.atendidoEn ? ` · ${horaListaChat(c.atendidoEn)}` : ''}
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
                {c.estado === 'atendido' ? (
                  onVolverPorAtender && (
                    <button
                      type="button"
                      className="msg-check msg-check-hecho"
                      aria-label="Volver a Por atender"
                      title={`Volver a Por atender el chat de ${c.nombre}`}
                      data-testid={`check-${c.id}`}
                      onClick={() => onVolverPorAtender(c.id, c.nombre)}
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  )
                ) : (
                  onAtendido && (
                    <button
                      type="button"
                      className="msg-check"
                      aria-label="Marcar como atendido"
                      title={`Marcar como atendido el chat de ${c.nombre}`}
                      data-testid={`check-${c.id}`}
                      onClick={() => onAtendido(c.id, c.nombre)}
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  )
                )}
                {onMarcarNoVisto && onMarcarVisto && (
                  <MenuFilaChat
                    nombre={c.nombre}
                    sinVer={sinVer}
                    onMarcarNoVisto={() => onMarcarNoVisto(c.id)}
                    onMarcarVisto={() => onMarcarVisto(c.id)}
                  />
                )}
              </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
