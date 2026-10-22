import { useState, useEffect, useCallback } from 'react';
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

export function ReclamosAdminView() {
  const { usuario, tiene } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';
  const puedeResponder = tiene('reclamos/responder') || esAdmin;

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  // Estados de datos
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reclamos, setReclamos] = useState<ReclamoAdminItem[]>([]);
  const [total, setTotal] = useState(0);

  // Modal de Detalle
  const [reclamoDetalle, setReclamoDetalle] = useState<ReclamoAdminDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Acciones: En revisión
  const [mostrarConfirmarRevision, setMostrarConfirmarRevision] = useState(false);
  const [marcandoRevision, setMarcandoRevision] = useState(false);

  // Acciones: Responder
  const [mostrarModalResponder, setMostrarModalResponder] = useState(false);
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

  const abrirDetalle = async (item: ReclamoAdminItem) => {
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setReclamoDetalle(null);
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
      setErrorRespuesta('La respuesta debe tener al menos 20 caracteres');
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
      setMostrarModalResponder(false);
      setTextoRespuesta('');
      const actualizado = await comprobantesApi.obtenerReclamoPorId(reclamoDetalle.id);
      setReclamoDetalle(actualizado);
      await cargarReclamos(pagina);
    } catch (err: any) {
      setErrorRespuesta(err?.message || 'Error al registrar la respuesta');
      setMostrarConfirmarResponder(false);
    } finally {
      setEnviandoRespuesta(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--cp-navy)' }}>
            Libro de Reclamaciones
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: '14px' }}>
            Atención obligatoria de reclamos y quejas virtuales según el D.S. 011-2011-PCM y Ley 29733.
          </p>
        </div>
        <Boton
          variante="secundario"
          onClick={() => cargarReclamos(pagina)}
          cargando={cargando}
        >
          Actualizar listado
        </Boton>
      </div>

      {/* Barra de Filtros */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: 'var(--cp-white)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid var(--cp-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>Estado:</span>
          {(['todos', 'RECIBIDO', 'EN_REVISION', 'RESPONDIDO'] as const).map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => {
                setFiltroEstado(est);
                setPagina(1);
              }}
              style={{
                minHeight: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: filtroEstado === est ? 'var(--cp-navy)' : 'transparent',
                color: filtroEstado === est ? 'var(--cp-cream)' : 'var(--cp-navy)',
              }}
            >
              {est === 'todos' ? 'Todos' : est === 'EN_REVISION' ? 'En revisión' : est === 'RECIBIDO' ? 'Recibidos' : 'Respondidos'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)' }}>Tipo:</span>
          {(['todos', 'RECLAMO', 'QUEJA'] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setFiltroTipo(tipo);
                setPagina(1);
              }}
              style={{
                minHeight: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: filtroTipo === tipo ? 'var(--cp-navy)' : 'transparent',
                color: filtroTipo === tipo ? 'var(--cp-cream)' : 'var(--cp-navy)',
              }}
            >
              {tipo === 'todos' ? 'Todos' : tipo === 'RECLAMO' ? 'Reclamos' : 'Quejas'}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido principal */}
      {cargando && reclamos.length === 0 && (
        <Cargando mensaje="Cargando solicitudes del Libro de Reclamaciones..." />
      )}

      {error && reclamos.length === 0 && (
        <EstadoError
          mensaje={error}
          alReintentar={() => cargarReclamos(pagina)}
        />
      )}

      {!cargando && !error && reclamos.length === 0 && (
        <EstadoVacio
          titulo="No hay reclamos registrados"
          mensaje="No se encontraron registros con los filtros seleccionados."
        />
      )}

      {reclamos.length > 0 && (
        <>
          <div className="tabla-tactil-envoltura">
            <table className="tabla-tactil">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Plazo legal</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {reclamos.map((r) => {
                  const urg = obtenerEstiloUrgencia(r.diasHabilesRestantes);
                  const fechaStr = r.creado_en ? new Date(r.creado_en).toLocaleDateString('es-PE') : '-';
                  const docMostrar = enmascararDocumento(r.documento, esAdmin);

                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 800 }}>{r.numero}</td>
                      <td>
                        <Insignia variante={r.tipo === 'RECLAMO' ? 'peligro' : 'aviso'}>
                          {r.tipo}
                        </Insignia>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                      <td style={{ fontFamily: 'monospace' }}>{docMostrar}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: urg.bg,
                            color: urg.fg,
                            border: `1px solid ${urg.borde}`,
                          }}
                        >
                          {r.plazoTexto || urg.etiqueta}
                        </span>
                      </td>
                      <td>
                        <Insignia
                          variante={
                            r.estado === 'RESPONDIDO'
                              ? 'exito'
                              : r.estado === 'EN_REVISION'
                                ? 'aviso'
                                : 'neutro'
                          }
                        >
                          {r.estado === 'EN_REVISION' ? 'EN REVISIÓN' : r.estado}
                        </Insignia>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {fechaStr}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Boton
                          variante="secundario"
                          onClick={() => abrirDetalle(r)}
                        >
                          Ver detalle
                        </Boton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {/* Modal de Detalle de Reclamo (auditado con VER_RECLAMO) */}
      {(cargandoDetalle || reclamoDetalle || errorDetalle) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-detalle-reclamo"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            backgroundColor: 'rgba(11, 44, 62, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1.5px solid var(--cp-navy)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
              padding: '24px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {cargandoDetalle && <Cargando mensaje="Consultando detalle y auditando acceso..." />}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 id="titulo-detalle-reclamo" style={{ fontSize: '20px', color: 'var(--cp-navy)' }}>
                      {reclamoDetalle.tipo}: {reclamoDetalle.numero}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <Insignia
                        variante={
                          reclamoDetalle.estado === 'RESPONDIDO'
                            ? 'exito'
                            : reclamoDetalle.estado === 'EN_REVISION'
                              ? 'aviso'
                              : 'neutro'
                        }
                      >
                        {reclamoDetalle.estado === 'EN_REVISION' ? 'EN REVISIÓN' : reclamoDetalle.estado}
                      </Insignia>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          ...(() => {
                            const u = obtenerEstiloUrgencia(reclamoDetalle.diasHabilesRestantes);
                            return { backgroundColor: u.bg, color: u.fg, border: `1px solid ${u.borde}` };
                          })(),
                        }}
                      >
                        {reclamoDetalle.plazoTexto} (Límite: {reclamoDetalle.fecha_limite})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReclamoDetalle(null)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      fontSize: '22px',
                      fontWeight: 800,
                      color: 'var(--cp-navy)',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                    aria-label="Cerrar detalle"
                  >
                    ×
                  </button>
                </div>

                {/* Datos del Cliente */}
                <div style={{ border: '1px solid var(--cp-line)', borderRadius: '10px', padding: '12px', backgroundColor: 'var(--cp-cream)' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '6px' }}>DATOS DEL CONSUMIDOR</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px' }}>
                    <div><b>Nombre:</b> {reclamoDetalle.nombre}</div>
                    <div><b>Documento:</b> <span style={{ fontFamily: 'monospace' }}>{enmascararDocumento(reclamoDetalle.documento, esAdmin)}</span></div>
                    <div><b>Domicilio:</b> {reclamoDetalle.domicilio}</div>
                    <div><b>Teléfono:</b> {enmascararDocumento(reclamoDetalle.telefono, esAdmin)}</div>
                    {reclamoDetalle.correo && <div><b>Correo:</b> {reclamoDetalle.correo}</div>}
                    {reclamoDetalle.pedido && <div><b>Pedido:</b> {reclamoDetalle.pedido.codigo} (S/ {reclamoDetalle.pedido.total})</div>}
                    {reclamoDetalle.monto_reclamado !== null && (
                      <div><b>Monto reclamado:</b> {formatearSoles(reclamoDetalle.monto_reclamado)}</div>
                    )}
                  </div>
                </div>

                {/* Detalle del reclamo */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '4px' }}>
                    DETALLE DEL RECLAMO O QUEJA
                  </div>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--cp-sand)',
                      fontSize: '14px',
                      lineHeight: '20px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {reclamoDetalle.detalle}
                  </div>
                </div>

                {/* Respuesta si ya fue respondido */}
                {reclamoDetalle.estado === 'RESPONDIDO' && (
                  <div style={{ border: '1.5px solid var(--cp-green)', borderRadius: '10px', padding: '12px', backgroundColor: 'var(--cp-greenbg)' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-green)', marginBottom: '4px' }}>
                      RESPUESTA FORMAL (YA RESPONDIDO)
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: '20px', whiteSpace: 'pre-wrap', color: 'var(--cp-navy)' }}>
                      {reclamoDetalle.respuesta}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '8px' }}>
                      Respondido el: {reclamoDetalle.respondido_en ? new Date(reclamoDetalle.respondido_en).toLocaleString('es-PE') : '-'}
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '12px' }}>
                  <Boton variante="secundario" onClick={() => setReclamoDetalle(null)}>
                    Cerrar
                  </Boton>

                  {puedeResponder && reclamoDetalle.estado === 'RECIBIDO' && (
                    <Boton
                      variante="secundario"
                      onClick={() => setMostrarConfirmarRevision(true)}
                    >
                      En revisión
                    </Boton>
                  )}

                  {puedeResponder && reclamoDetalle.estado !== 'RESPONDIDO' && (
                    <Boton
                      variante="primario"
                      onClick={() => {
                        setTextoRespuesta('');
                        setErrorRespuesta(null);
                        setMostrarModalResponder(true);
                      }}
                    >
                      Responder
                    </Boton>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmar "En revisión" */}
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

      {/* Modal para escribir respuesta */}
      {mostrarModalResponder && reclamoDetalle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-responder-reclamo"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 95,
            backgroundColor: 'rgba(11, 44, 62, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1.5px solid var(--cp-navy)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h3 id="titulo-responder-reclamo" style={{ fontSize: '18px', color: 'var(--cp-navy)' }}>
                Responder a {reclamoDetalle.numero}
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: '13px' }}>
                Cliente: <b>{reclamoDetalle.nombre}</b>. Esta respuesta es formal y única (mínimo 20 caracteres).
              </p>
            </div>

            <div>
              <label
                htmlFor="campo-respuesta-reclamo"
                style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}
              >
                Respuesta formal al consumidor
              </label>
              <textarea
                id="campo-respuesta-reclamo"
                rows={5}
                value={textoRespuesta}
                onChange={(e) => {
                  setTextoRespuesta(e.target.value);
                  if (errorRespuesta) setErrorRespuesta(null);
                }}
                placeholder="Escribe la respuesta detallada de la empresa..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '8px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                <span>{textoRespuesta.trim().length} / 20 caracteres mínimos</span>
                {errorRespuesta && (
                  <span style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>
                    {errorRespuesta}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Boton
                variante="secundario"
                onClick={() => setMostrarModalResponder(false)}
                deshabilitado={enviandoRespuesta}
              >
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                onClick={validarRespuesta}
                deshabilitado={textoRespuesta.trim().length < 20 || enviandoRespuesta}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar respuesta Sí/No */}
      {mostrarConfirmarResponder && reclamoDetalle && (
        <Confirmar
          abierto={mostrarConfirmarResponder}
          titulo="¿Confirmar respuesta formal?"
          mensaje={`¿Confirmas el envío de esta respuesta para el reclamo ${reclamoDetalle.numero}? Esta acción cierra el reclamo y no se puede editar ni borrar.`}
          textoConfirmar="Sí, registrar respuesta"
          textoNo="No, corregir"
          alConfirmar={handleResponder}
          alCancelar={() => setMostrarConfirmarResponder(false)}
          cargando={enviandoRespuesta}
        />
      )}
    </div>
  );
}
