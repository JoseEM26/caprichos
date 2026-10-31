import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Insignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { comprobantesApi } from './comprobantesApi';
import type {
  ReclamoAdminItem,
  ReclamoAdminDetalle,
} from './tipos';
import {
  enmascararDocumento,
  formatearSoles,
  obtenerEstiloUrgencia,
} from './utilidades';
import './reclamos.css';
import { QuejasWhatsAppTab } from '../reclamos/QuejasWhatsAppTab';
import { FiltroCombo } from '../../comun/FiltroCombo';

export function ReclamosAdminView() {
  const { usuario, tiene } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';
  const puedeResponder = tiene('reclamos/responder') || esAdmin;

  // Pestaña principal: Libro de Reclamaciones (Legal) vs Quejas de WhatsApp (Chatbot)
  const [pestanaModulo, setPestanaModulo] = useState<'libro' | 'whatsapp'>('libro');

  // Filtros de estado y tipo
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  // Estados de datos
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reclamos, setReclamos] = useState<ReclamoAdminItem[]>([]);
  const [total, setTotal] = useState(0);

  // Modal de Detalle por pasos cortos
  const [reclamoDetalle, setReclamoDetalle] = useState<ReclamoAdminDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [pasoModal, setPasoModal] = useState<number>(1);

  // Acciones: En revisión
  const [mostrarConfirmarRevision, setMostrarConfirmarRevision] = useState(false);
  const [marcandoRevision, setMarcandoRevision] = useState(false);

  // Acciones: Responder
  const [textoRespuesta, setTextoRespuesta] = useState('');
  const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);
  const [mostrarConfirmarResponder, setMostrarConfirmarResponder] = useState(false);
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false);

  const cargarReclamos = useCallback(async (pag = 1) => {
    setCargando(true);
    setError(null);
    try {
      const resp = await comprobantesApi.listarReclamos({
        estado: filtroEstado === 'todos' ? undefined : filtroEstado,
        tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
        pagina: pag,
        limite,
      });
      setReclamos(resp.items || []);
      setTotal(resp.total || 0);
      setPagina(resp.pagina || pag);
    } catch (err: any) {
      setError(err?.message || 'Error al listar los reclamos y quejas');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroTipo, limite]);

  useEffect(() => {
    cargarReclamos(pagina);
  }, [cargarReclamos, pagina]);

  // Filtrado local por término de búsqueda (número, cliente, documento, detalle, teléfono)
  const reclamosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return reclamos;
    return reclamos.filter((r) => {
      const num = r.numero.toLowerCase();
      const nom = r.nombre.toLowerCase();
      const doc = r.documento.toLowerCase();
      const det = r.detalle.toLowerCase();
      const tel = (r.telefono || '').toLowerCase();
      const ped = (r.pedido_id || '').toLowerCase();
      return (
        num.includes(q) ||
        nom.includes(q) ||
        doc.includes(q) ||
        det.includes(q) ||
        tel.includes(q) ||
        ped.includes(q)
      );
    });
  }, [reclamos, busqueda]);

  const abrirDetalle = async (item: ReclamoAdminItem) => {
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setReclamoDetalle(null);
    setPasoModal(1);
    setTextoRespuesta('');
    setErrorRespuesta(null);
    try {
      const detalle = await comprobantesApi.obtenerReclamoPorId(item.id);
      setReclamoDetalle(detalle);
    } catch (err: any) {
      setErrorDetalle(err?.message || 'Error al obtener el detalle del reclamo');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleMarcarEnRevision = async () => {
    if (!reclamoDetalle) return;
    setMarcandoRevision(true);
    try {
      await comprobantesApi.marcarEnRevision(reclamoDetalle.id);
      setMostrarConfirmarRevision(false);
      const actualizado = await comprobantesApi.obtenerReclamoPorId(reclamoDetalle.id);
      setReclamoDetalle(actualizado);
      await cargarReclamos(pagina);
    } catch (err: any) {
      setErrorDetalle(err?.message || 'Error al marcar en revisión');
      setMostrarConfirmarRevision(false);
    } finally {
      setMarcandoRevision(false);
    }
  };

  const validarRespuesta = () => {
    const limpia = textoRespuesta.trim();
    if (limpia.length < 20) {
      setErrorRespuesta('La respuesta formal debe tener al menos 20 caracteres');
      return;
    }
    setErrorRespuesta(null);
    setMostrarConfirmarResponder(true);
  };

  const handleResponder = async () => {
    if (!reclamoDetalle) return;
    setEnviandoRespuesta(true);
    try {
      await comprobantesApi.responderReclamo(reclamoDetalle.id, textoRespuesta.trim());
      setMostrarConfirmarResponder(false);
      setTextoRespuesta('');
      const actualizado = await comprobantesApi.obtenerReclamoPorId(reclamoDetalle.id);
      setReclamoDetalle(actualizado);
      await cargarReclamos(pagina);
    } catch (err: any) {
      setErrorRespuesta(err?.message || 'Error al registrar la respuesta formal');
      setMostrarConfirmarResponder(false);
    } finally {
      setEnviandoRespuesta(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <div className="reclamos-contenedor">
      {/* Selector de pestaña: Libro de Reclamaciones (Legal) vs Quejas de WhatsApp (Informal) */}
      <div
        role="tablist"
        aria-label="Pestañas de atención y reclamos"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--cp-line)',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <button
          role="tab"
          aria-selected={pestanaModulo === 'libro'}
          type="button"
          onClick={() => setPestanaModulo('libro')}
          className={`reclamos-pildora-btn ${pestanaModulo === 'libro' ? 'activa' : ''}`}
          style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '10px' }}
        >
          Libro de Reclamaciones (Legal)
        </button>
        <button
          role="tab"
          aria-selected={pestanaModulo === 'whatsapp'}
          type="button"
          onClick={() => setPestanaModulo('whatsapp')}
          className={`reclamos-pildora-btn ${pestanaModulo === 'whatsapp' ? 'activa' : ''}`}
          style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '10px' }}
        >
          Quejas de WhatsApp (Chatbot)
        </button>
      </div>

      {pestanaModulo === 'whatsapp' ? (
        <QuejasWhatsAppTab puedeResponder={puedeResponder} />
      ) : (
        <>
          {/* 1. Barra superior de controles: Búsqueda y Actualizar */}
          <div className="reclamos-barra-controles">
        <div className="reclamos-buscador-envoltura">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--cp-soft)', flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <label htmlFor="buscador-reclamos" style={{ position: 'absolute', left: -9999 }}>
            Buscar reclamo
          </label>
          <input
            id="buscador-reclamos"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número, cliente o detalle..."
            className="reclamos-buscador-input"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="reclamos-buscador-limpiar"
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <Boton
          variante="secundario"
          onClick={() => cargarReclamos(pagina)}
          cargando={cargando}
        >
          Actualizar listado
        </Boton>
      </div>

      {/* 2. Barra de filtros con píldoras */}
      <div className="reclamos-filtros-seccion">
        <div className="reclamos-grupo-pildoras">
          <FiltroCombo
            etiqueta="Estado"
            valor={filtroEstado}
            valorPorDefecto="todos"
            opciones={[
              { valor: 'todos', etiqueta: 'Todos' },
              { valor: 'RECIBIDO', etiqueta: 'Recibidos' },
              { valor: 'EN_REVISION', etiqueta: 'En revisión' },
              { valor: 'RESPONDIDO', etiqueta: 'Respondidos' },
            ]}
            alCambiar={(v) => {
              setFiltroEstado(v);
              setPagina(1);
            }}
          />
          <FiltroCombo
            etiqueta="Tipo"
            valor={filtroTipo}
            valorPorDefecto="todos"
            opciones={[
              { valor: 'todos', etiqueta: 'Todos' },
              { valor: 'RECLAMO', etiqueta: 'Reclamos' },
              { valor: 'QUEJA', etiqueta: 'Quejas' },
            ]}
            alCambiar={(v) => {
              setFiltroTipo(v);
              setPagina(1);
            }}
          />
        </div>

        <div className="reclamos-contador-resumen">
          {busqueda.trim()
            ? `Mostrando ${reclamosFiltrados.length} de ${total} registros`
            : `${total} ${total === 1 ? 'registro en total' : 'registros en total'}`}
        </div>
      </div>

      {/* 3. Contenido principal: Estados y Tarjetas */}
      {cargando && reclamos.length === 0 && (
        <Cargando mensaje="Cargando solicitudes del Libro de Reclamaciones..." />
      )}

      {error && reclamos.length === 0 && (
        <EstadoError
          mensaje={error}
          alReintentar={() => cargarReclamos(pagina)}
        />
      )}

      {!cargando && !error && reclamosFiltrados.length === 0 && (
        <EstadoVacio
          titulo="No se encontraron registros"
          mensaje="No hay reclamos o quejas que coincidan con los filtros y búsqueda seleccionados."
        />
      )}

      {reclamosFiltrados.length > 0 && (
        <>
          <div className="reclamos-grid-tarjetas">
            {reclamosFiltrados.map((r) => {
              const urg = obtenerEstiloUrgencia(r.diasHabilesRestantes);
              const fechaStr = r.creado_en
                ? new Date(r.creado_en).toLocaleDateString('es-PE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '-';
              const docMostrar = enmascararDocumento(r.documento, esAdmin);

              return (
                <article
                  key={r.id}
                  className="reclamo-tarjeta"
                  style={{ borderLeft: `6px solid ${urg.borde}` }}
                >
                  {/* Cabecera */}
                  <div className="reclamo-tarjeta-cabecera">
                    <div className="reclamo-tarjeta-titulo-grupo">
                      <span className="reclamo-numero">{r.numero}</span>
                      <span className="reclamo-fecha">{fechaStr}</span>
                    </div>

                    <div className="reclamo-tarjeta-insignias">
                      <Insignia variante={r.tipo === 'RECLAMO' ? 'peligro' : 'aviso'}>
                        {r.tipo === 'RECLAMO' ? 'Reclamo' : 'Queja'}
                      </Insignia>
                      <Insignia
                        variante={
                          r.estado === 'RESPONDIDO'
                            ? 'exito'
                            : r.estado === 'EN_REVISION'
                            ? 'aviso'
                            : 'neutro'
                        }
                      >
                        {r.estado === 'EN_REVISION'
                          ? 'En revisión'
                          : r.estado === 'RECIBIDO'
                          ? 'Recibido'
                          : 'Respondido'}
                      </Insignia>
                    </div>
                  </div>

                  {/* Plazo legal */}
                  <div className="reclamo-tarjeta-plazo">
                    <span
                      className="reclamo-plazo-badge"
                      style={{
                        backgroundColor: urg.bg,
                        color: urg.fg,
                        borderColor: urg.borde,
                      }}
                    >
                      {r.plazoTexto || urg.etiqueta}
                    </span>
                  </div>

                  {/* Datos del cliente y pedido */}
                  <div className="reclamo-tarjeta-datos">
                    <div className="reclamo-dato-fila">
                      <span className="reclamo-dato-etiqueta">Cliente:</span>
                      <span className="reclamo-dato-valor reclamo-cliente-nombre">{r.nombre}</span>
                    </div>
                    <div className="reclamo-dato-fila">
                      <span className="reclamo-dato-etiqueta">Documento:</span>
                      <span className="reclamo-dato-valor reclamo-doc">{docMostrar}</span>
                    </div>
                    {r.pedido_id && (
                      <div className="reclamo-dato-fila">
                        <span className="reclamo-dato-etiqueta">Pedido:</span>
                        <span className="reclamo-dato-valor">
                          #{r.pedido_id}
                          {r.monto_reclamado != null && ` · ${formatearSoles(r.monto_reclamado)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Resumen del detalle */}
                  <div className="reclamo-tarjeta-resumen" title={r.detalle}>
                    <span style={{ fontWeight: 700, color: 'var(--cp-soft)' }}>Detalle: </span>
                    {r.detalle}
                  </div>

                  {/* Botón de acción */}
                  <div className="reclamo-tarjeta-pie">
                    <Boton
                      variante="secundario"
                      onClick={() => abrirDetalle(r)}
                    >
                      Ver detalle
                    </Boton>
                  </div>
                </article>
              );
            })}
          </div>

          <Paginacion
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            totalRegistros={total}
            tamanoPagina={limite}
            alCambiarPagina={(p) => setPagina(p)}
          />
        </>
      )}

      {/* 4. Modal de Detalle por Pasos Cortos (auditado con VER_RECLAMO en API) */}
      {(cargandoDetalle || reclamoDetalle || errorDetalle) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-reclamo"
          className="reclamo-modal-overlay"
        >
          <div className="reclamo-modal-contenedor">
            {cargandoDetalle && (
              <Cargando mensaje="Consultando detalle y auditando acceso..." />
            )}

            {errorDetalle && (
              <div>
                <EstadoError mensaje={errorDetalle} />
                <div style={{ marginTop: '12px', textAlign: 'right' }}>
                  <Boton variante="secundario" onClick={() => setErrorDetalle(null)}>
                    Cerrar
                  </Boton>
                </div>
              </div>
            )}

            {reclamoDetalle && !cargandoDetalle && (
              <>
                {/* Cabecera del modal */}
                <div className="reclamo-modal-cabecera">
                  <div>
                    <div className="reclamo-modal-meta">
                      <Insignia
                        variante={reclamoDetalle.tipo === 'RECLAMO' ? 'peligro' : 'aviso'}
                      >
                        {reclamoDetalle.tipo}
                      </Insignia>
                      <Insignia
                        variante={
                          reclamoDetalle.estado === 'RESPONDIDO'
                            ? 'exito'
                            : reclamoDetalle.estado === 'EN_REVISION'
                            ? 'aviso'
                            : 'neutro'
                        }
                      >
                        {reclamoDetalle.estado === 'EN_REVISION'
                          ? 'En revisión'
                          : reclamoDetalle.estado === 'RECIBIDO'
                          ? 'Recibido'
                          : 'Respondido'}
                      </Insignia>
                      {(() => {
                        const urg = obtenerEstiloUrgencia(reclamoDetalle.diasHabilesRestantes);
                        return (
                          <span
                            className="reclamo-plazo-badge"
                            style={{
                              backgroundColor: urg.bg,
                              color: urg.fg,
                              borderColor: urg.borde,
                            }}
                          >
                            {reclamoDetalle.plazoTexto || urg.etiqueta}
                          </span>
                        );
                      })()}
                    </div>

                    <h3 id="titulo-detalle-reclamo" className="reclamo-modal-titulo">
                      {reclamoDetalle.tipo}: {reclamoDetalle.numero}
                    </h3>

                    <p className="reclamo-modal-subtitulo">
                      Plazo legal: 15 días hábiles · Límite: {reclamoDetalle.fecha_limite}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReclamoDetalle(null)}
                    className="reclamo-btn-cerrar"
                    aria-label="Cerrar detalle"
                  >
                    ×
                  </button>
                </div>

                {/* Barra de Pasos Cortos (Stepper) */}
                <div className="reclamo-stepper" role="tablist" aria-label="Pasos del detalle">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pasoModal === 1}
                    className={`reclamo-step-btn ${pasoModal === 1 ? 'activo' : ''}`}
                    onClick={() => setPasoModal(1)}
                  >
                    <span className="step-num">1</span>
                    <span>Datos del cliente</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pasoModal === 2}
                    className={`reclamo-step-btn ${pasoModal === 2 ? 'activo' : ''}`}
                    onClick={() => setPasoModal(2)}
                  >
                    <span className="step-num">2</span>
                    <span>Detalle del reclamo</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pasoModal === 3}
                    className={`reclamo-step-btn ${pasoModal === 3 ? 'activo' : ''}`}
                    onClick={() => setPasoModal(3)}
                  >
                    <span className="step-num">3</span>
                    <span>Respuesta</span>
                  </button>
                </div>

                {/* Contenido del paso seleccionado */}
                <div className="reclamo-step-cuerpo">
                  {pasoModal === 1 && (
                    <div className="reclamo-paso-panel">
                      <div className="reclamo-seccion-titulo">
                        Paso 1: Datos del consumidor
                      </div>
                      <div className="reclamo-cuadricula-datos">
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Nombre completo</span>
                          <span className="campo-valor">{reclamoDetalle.nombre}</span>
                        </div>
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Documento de identidad</span>
                          <span className="campo-valor doc-mono">
                            {enmascararDocumento(reclamoDetalle.documento, esAdmin)}
                          </span>
                        </div>
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Domicilio</span>
                          <span className="campo-valor">{reclamoDetalle.domicilio}</span>
                        </div>
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Teléfono de contacto</span>
                          <span className="campo-valor">
                            {enmascararDocumento(reclamoDetalle.telefono, esAdmin)}
                          </span>
                        </div>
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Correo electrónico</span>
                          <span className="campo-valor">
                            {reclamoDetalle.correo || 'No proporcionado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {pasoModal === 2 && (
                    <div className="reclamo-paso-panel">
                      <div className="reclamo-seccion-titulo">
                        Paso 2: Detalle de los hechos y pedido
                      </div>
                      <div className="reclamo-cuadricula-datos">
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Pedido relacionado</span>
                          <span className="campo-valor">
                            {reclamoDetalle.pedido
                              ? `${reclamoDetalle.pedido.codigo} (S/ ${Number(
                                  reclamoDetalle.pedido.total,
                                ).toFixed(2)})`
                              : reclamoDetalle.pedido_id
                              ? `#${reclamoDetalle.pedido_id}`
                              : 'Sin pedido asociado'}
                          </span>
                        </div>
                        <div className="reclamo-campo-info">
                          <span className="campo-etiqueta">Monto reclamado</span>
                          <span className="campo-valor">
                            {reclamoDetalle.monto_reclamado != null
                              ? formatearSoles(reclamoDetalle.monto_reclamado)
                              : 'No especificado'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div
                          className="campo-etiqueta"
                          style={{ marginBottom: '6px', fontWeight: 700, color: 'var(--cp-soft)' }}
                        >
                          Descripción detallada registrada por el consumidor:
                        </div>
                        <div className="reclamo-detalle-caja">
                          {reclamoDetalle.detalle}
                        </div>
                      </div>
                    </div>
                  )}

                  {pasoModal === 3 && (
                    <div className="reclamo-paso-panel">
                      <div className="reclamo-seccion-titulo">
                        Paso 3: Respuesta del administrador
                      </div>

                      {reclamoDetalle.estado === 'RESPONDIDO' ? (
                        <div className="reclamo-respuesta-enviada">
                          <div className="respuesta-enviada-titulo">
                            Respuesta formal registrada (Atendido)
                          </div>
                          <div className="respuesta-enviada-cuerpo">
                            {reclamoDetalle.respuesta}
                          </div>
                          <div className="respuesta-enviada-meta">
                            Respondido el:{' '}
                            {reclamoDetalle.respondido_en
                              ? new Date(reclamoDetalle.respondido_en).toLocaleString('es-PE')
                              : '-'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {puedeResponder && reclamoDetalle.estado === 'RECIBIDO' && (
                            <div className="reclamo-aviso-revision">
                              <span>El reclamo está recibido y pendiente de análisis.</span>
                              <Boton
                                variante="secundario"
                                onClick={() => setMostrarConfirmarRevision(true)}
                              >
                                Poner en revisión
                              </Boton>
                            </div>
                          )}

                          {puedeResponder ? (
                            <div className="reclamo-campo-respuesta">
                              <label
                                htmlFor="campo-respuesta-reclamo"
                                className="campo-etiqueta"
                                style={{ fontWeight: 700 }}
                              >
                                Respuesta formal al consumidor (mínimo 20 caracteres):
                              </label>
                              <textarea
                                id="campo-respuesta-reclamo"
                                rows={4}
                                value={textoRespuesta}
                                onChange={(e) => {
                                  setTextoRespuesta(e.target.value);
                                  if (errorRespuesta) setErrorRespuesta(null);
                                }}
                                placeholder="Escribe la respuesta formal y fundamentada para el consumidor..."
                                className="reclamo-textarea"
                              />
                              <div className="reclamo-textarea-footer">
                                <span>
                                  {textoRespuesta.trim().length} / 20 caracteres mínimos
                                </span>
                                {errorRespuesta && (
                                  <span className="reclamo-error-txt">{errorRespuesta}</span>
                                )}
                              </div>
                              <div
                                style={{
                                  marginTop: '12px',
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                }}
                              >
                                <Boton
                                  variante="primario"
                                  onClick={validarRespuesta}
                                  deshabilitado={
                                    textoRespuesta.trim().length < 20 || enviandoRespuesta
                                  }
                                >
                                  Responder
                                </Boton>
                              </div>
                            </div>
                          ) : (
                            <div className="reclamo-sin-permiso">
                              No tienes permisos asignados para responder a este reclamo.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pie de navegación del modal */}
                <div className="reclamo-modal-pie">
                  <div className="pie-nav-izq">
                    {pasoModal > 1 && (
                      <Boton
                        variante="secundario"
                        onClick={() => setPasoModal((p) => p - 1)}
                      >
                        ← Anterior
                      </Boton>
                    )}
                  </div>

                  <div className="pie-nav-der">
                    {pasoModal < 3 ? (
                      <Boton
                        variante="primario"
                        onClick={() => setPasoModal((p) => p + 1)}
                      >
                        Siguiente →
                      </Boton>
                    ) : (
                      <Boton
                        variante="secundario"
                        onClick={() => setReclamoDetalle(null)}
                      >
                        Cerrar
                      </Boton>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmar "En revisión" (Sí/No) */}
      {mostrarConfirmarRevision && reclamoDetalle && (
        <Confirmar
          abierto={mostrarConfirmarRevision}
          titulo="¿Marcar reclamo en revisión?"
          mensaje={`¿Confirmas pasar el reclamo ${reclamoDetalle.numero} al estado EN REVISIÓN?`}
          textoConfirmar="Sí, poner en revisión"
          textoNo="Cancelar"
          alConfirmar={handleMarcarEnRevision}
          alCancelar={() => setMostrarConfirmarRevision(false)}
          cargando={marcandoRevision}
        />
      )}

          {/* Confirmar respuesta formal (Sí/No) */}
          {mostrarConfirmarResponder && reclamoDetalle && (
            <Confirmar
              abierto={mostrarConfirmarResponder}
              titulo="¿Confirmar respuesta formal?"
              mensaje={`¿Confirmas el envío de esta respuesta para el reclamo ${reclamoDetalle.numero}? Esta acción registra la respuesta formal y cierra el reclamo.`}
              textoConfirmar="Sí, registrar respuesta"
              textoNo="No, corregir"
              alConfirmar={handleResponder}
              alCancelar={() => setMostrarConfirmarResponder(false)}
              cargando={enviandoRespuesta}
            />
          )}
        </>
      )}
    </div>
  );
}
