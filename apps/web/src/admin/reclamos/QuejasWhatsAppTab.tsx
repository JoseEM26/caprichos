import { useCallback, useEffect, useState } from 'react';
import { comprobantesApi } from '../comprobantes/comprobantesApi';
import type { QuejaWhatsAppItem, ResumenQuejasWhatsApp } from '../comprobantes/tipos';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Paginacion } from '../../comun/Paginacion';

export interface QuejasWhatsAppTabProps {
  puedeResponder: boolean;
}

export function QuejasWhatsAppTab({ puedeResponder }: QuejasWhatsAppTabProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quejas, setQuejas] = useState<QuejaWhatsAppItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const limite = 20;

  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [resumen, setResumen] = useState<ResumenQuejasWhatsApp>({
    promedio: 0,
    totalEncuestas: 0,
    totalQuejas: 0,
    todas: 0,
    nuevas: 0,
    enRevision: 0,
    resueltas: 0,
  });

  // Modal de Detalle y Acciones
  const [quejaSeleccionada, setQuejaSeleccionada] = useState<QuejaWhatsAppItem | null>(null);
  const [notaResolucion, setNotaResolucion] = useState('');
  const [mostrarConfirmarRevision, setMostrarConfirmarRevision] = useState(false);
  const [mostrarConfirmarResolver, setMostrarConfirmarResolver] = useState(false);
  const [guardandoAccion, setGuardandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargarQuejas = useCallback(async (pag = 1) => {
    setCargando(true);
    setError(null);
    try {
      const resp = await comprobantesApi.listarQuejasWhatsApp({
        estado: filtroEstado === 'todos' ? undefined : filtroEstado,
        pagina: pag,
        limite,
      });
      setQuejas(resp.quejas || []);
      setTotal(resp.total || 0);
      setPagina(resp.pagina || pag);
      if (resp.resumen) {
        setResumen(resp.resumen);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al listar las quejas de WhatsApp');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, limite]);

  useEffect(() => {
    cargarQuejas(pagina);
  }, [cargarQuejas, pagina]);

  const abrirDetalle = (q: QuejaWhatsAppItem) => {
    setQuejaSeleccionada(q);
    setNotaResolucion(q.resolucion || '');
    setErrorAccion(null);
  };

  const handleMarcarEnRevision = async () => {
    if (!quejaSeleccionada) return;
    setGuardandoAccion(true);
    setErrorAccion(null);
    try {
      await comprobantesApi.cambiarEstadoQuejaWhatsApp(quejaSeleccionada.id, {
        estado: 'EN_REVISION',
        nota: notaResolucion || undefined,
      });
      setMostrarConfirmarRevision(false);
      const actualizada = await comprobantesApi.obtenerQuejaWhatsApp(quejaSeleccionada.id);
      setQuejaSeleccionada(actualizada);
      await cargarQuejas(pagina);
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al marcar en revisión');
      setMostrarConfirmarRevision(false);
    } finally {
      setGuardandoAccion(false);
    }
  };

  const handleResolverQueja = async () => {
    if (!quejaSeleccionada) return;
    setGuardandoAccion(true);
    setErrorAccion(null);
    try {
      await comprobantesApi.cambiarEstadoQuejaWhatsApp(quejaSeleccionada.id, {
        estado: 'RESUELTA',
        nota: notaResolucion.trim(),
      });
      setMostrarConfirmarResolver(false);
      const actualizada = await comprobantesApi.obtenerQuejaWhatsApp(quejaSeleccionada.id);
      setQuejaSeleccionada(actualizada);
      await cargarQuejas(pagina);
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al resolver la queja');
      setMostrarConfirmarResolver(false);
    } finally {
      setGuardandoAccion(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Nota de Advertencia Operativa vs Legal */}
      <div
        role="note"
        style={{
          background: 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '13px',
          color: 'var(--cp-navy)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ fontWeight: 800, color: 'var(--cp-orange)', fontSize: '18px' }}>ℹ</div>
        <div>
          <b>Canal informal de atención al cliente:</b> Estas quejas provienen de la encuesta
          posventa o chat de WhatsApp. Están <b>claramente separadas</b> del Libro de Reclamaciones
          legal y no están sujetas al plazo perentorio de 15 días hábiles. Si un caso amerita elevarse
          a reclamo formal, debe registrarse manualmente en el Libro de Reclamaciones.
        </div>
      </div>

      {/* 2. Tarjetas de Resumen y Métricas de Satisfacción */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
            Satisfacción Posventa
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontSize: '28px',
                fontWeight: 800,
                color: resumen.promedio >= 4 ? 'var(--cp-green)' : resumen.promedio >= 3 ? 'var(--cp-orange)' : 'var(--cp-rust)',
              }}
            >
              {resumen.promedio > 0 ? `${resumen.promedio} / 5` : 'Sin datos'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
            {resumen.totalEncuestas} {resumen.totalEncuestas === 1 ? 'encuesta respondida' : 'encuestas respondidas'}
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
            Quejas Nuevas
          </div>
          <div style={{ marginTop: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontSize: '28px',
                fontWeight: 800,
                color: resumen.nuevas > 0 ? 'var(--cp-rust)' : 'var(--cp-navy)',
              }}
            >
              {resumen.nuevas}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
            Requieren atención prioritaria
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
            En Revisión / Resueltas
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontSize: '20px', fontWeight: 800, color: 'var(--cp-navy)' }}>
              {resumen.enRevision} en revisión
            </span>
            <span style={{ fontSize: '14px', color: 'var(--cp-green)', fontWeight: 700 }}>
              {resumen.resueltas} resueltas
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
            Total acumulado: {resumen.totalQuejas} quejas
          </div>
        </div>
      </div>

      {/* 3. Filtros por estado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>Filtrar estado:</span>
          {(['todos', 'NUEVA', 'EN_REVISION', 'RESUELTA'] as const).map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => {
                setFiltroEstado(est);
                setPagina(1);
              }}
              className={`reclamos-pildora-btn ${filtroEstado === est ? 'activa' : ''}`}
            >
              {est === 'todos'
                ? 'Todas'
                : est === 'NUEVA'
                ? 'Nuevas'
                : est === 'EN_REVISION'
                ? 'En revisión'
                : 'Resueltas'}
            </button>
          ))}
        </div>

        <Boton
          variante="secundario"
          tamano="pequeno"
          onClick={() => cargarQuejas(pagina)}
          cargando={cargando}
        >
          Actualizar quejas
        </Boton>
      </div>

      {/* 4. Contenido Principal */}
      {cargando && quejas.length === 0 && (
        <Cargando mensaje="Cargando quejas de WhatsApp..." />
      )}

      {error && quejas.length === 0 && (
        <EstadoError mensaje={error} alReintentar={() => cargarQuejas(pagina)} />
      )}

      {!cargando && !error && quejas.length === 0 && (
        <EstadoVacio
          titulo="Sin quejas de WhatsApp"
          descripcion="No hay quejas registradas para el filtro seleccionado."
        />
      )}

      {!cargando && !error && quejas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {quejas.map((q) => {
            const varianteInsignia =
              q.estado === 'RESUELTA'
                ? 'exito'
                : q.estado === 'EN_REVISION'
                ? 'aviso'
                : 'peligro';

            const etiquetaEstado =
              q.estado === 'RESUELTA'
                ? 'Resuelta'
                : q.estado === 'EN_REVISION'
                ? 'En revisión'
                : 'Nueva';

            return (
              <div
                key={q.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Insignia variante={varianteInsignia}>{etiquetaEstado}</Insignia>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                      {q.cliente}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      Tel: {q.telefonoEnmascarado}
                    </span>
                    {q.pedidoCodigo && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          background: 'var(--cp-sand)',
                          borderRadius: '8px',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        Pedido {q.pedidoCodigo}
                      </span>
                    )}
                    {q.puntaje && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: q.puntaje <= 2 ? 'var(--cp-rust)' : 'var(--cp-green)',
                        }}
                      >
                        Puntaje: {q.puntaje}/5
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-navy)', fontStyle: 'italic' }}>
                    "{q.texto}"
                  </p>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                    <span>Fecha: {new Date(q.creadaEn).toLocaleString('es-PE')}</span>
                    {q.atendidaPor && <span>Atendida por: {q.atendidaPor}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Boton
                    variante="secundario"
                    tamano="pequeno"
                    onClick={() => abrirDetalle(q)}
                  >
                    Ver detalle
                  </Boton>
                </div>
              </div>
            );
          })}

          <Paginacion
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            alCambiarPagina={(p) => setPagina(p)}
          />
        </div>
      )}

      {/* 5. Modal de Detalle y Gestión de Queja */}
      {quejaSeleccionada && (
        <>
          <div
            onClick={() => setQuejaSeleccionada(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 44, 62, 0.55)',
              zIndex: 998,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de queja de WhatsApp"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(640px, calc(100% - 32px))',
              maxHeight: 'calc(100% - 48px)',
              overflowY: 'auto',
              background: 'var(--cp-cream)',
              borderRadius: '20px',
              padding: '24px',
              zIndex: 999,
              boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontSize: '18px', color: 'var(--cp-navy)' }}>
                  Queja de WhatsApp
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  ID: {quejaSeleccionada.id} • Origen: {quejaSeleccionada.origen}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setQuejaSeleccionada(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  cursor: 'pointer',
                  color: 'var(--cp-soft)',
                }}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div><b>Cliente:</b> {quejaSeleccionada.cliente}</div>
              <div><b>Teléfono (enmascarado):</b> {quejaSeleccionada.telefonoEnmascarado}</div>
              {quejaSeleccionada.pedidoCodigo && (
                <div><b>Pedido asociado:</b> {quejaSeleccionada.pedidoCodigo}</div>
              )}
              {quejaSeleccionada.puntaje && (
                <div><b>Calificación:</b> {quejaSeleccionada.puntaje} / 5</div>
              )}
              <div><b>Estado actual:</b> {quejaSeleccionada.estado}</div>
              <div><b>Mensaje del cliente:</b></div>
              <div
                style={{
                  background: 'var(--cp-sand)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontStyle: 'italic',
                }}
              >
                "{quejaSeleccionada.texto}"
              </div>
              {quejaSeleccionada.resolucion && (
                <div style={{ marginTop: '8px' }}>
                  <b>Resolución previa:</b> {quejaSeleccionada.resolucion}
                </div>
              )}
            </div>

            {puedeResponder && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  htmlFor="nota-resolucion-wa"
                  style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}
                >
                  Nota de atención o resolución interna:
                </label>
                <textarea
                  id="nota-resolucion-wa"
                  rows={3}
                  value={notaResolucion}
                  onChange={(e) => setNotaResolucion(e.target.value)}
                  placeholder="Detalla las acciones tomadas o acuerdo con el cliente..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--cp-line)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {errorAccion && (
              <div style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 600 }}>
                {errorAccion}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <Boton variante="secundario" onClick={() => setQuejaSeleccionada(null)}>
                Cerrar
              </Boton>

              {puedeResponder && quejaSeleccionada.estado !== 'EN_REVISION' && quejaSeleccionada.estado !== 'RESUELTA' && (
                <Boton
                  variante="secundario"
                  onClick={() => setMostrarConfirmarRevision(true)}
                  cargando={guardandoAccion}
                >
                  Marcar en revisión
                </Boton>
              )}

              {puedeResponder && quejaSeleccionada.estado !== 'RESUELTA' && (
                <Boton
                  variante="primario"
                  onClick={() => setMostrarConfirmarResolver(true)}
                  cargando={guardandoAccion}
                >
                  Resolver queja
                </Boton>
              )}
            </div>
          </div>
        </>
      )}

      {/* Diálogos de Confirmación Sí/No */}
      <Confirmar
        abierto={mostrarConfirmarRevision}
        titulo="¿Marcar queja en revisión?"
        mensaje="La queja pasará al estado EN_REVISION para indicar que un responsable está atendiendo el caso."
        alConfirmar={handleMarcarEnRevision}
        alCancelar={() => setMostrarConfirmarRevision(false)}
        cargando={guardandoAccion}
      />

      <Confirmar
        abierto={mostrarConfirmarResolver}
        titulo="¿Resolver esta queja de WhatsApp?"
        mensaje="Se registrará la resolución interna y la queja quedará marcada como RESUELTA."
        alConfirmar={handleResolverQueja}
        alCancelar={() => setMostrarConfirmarResolver(false)}
        cargando={guardandoAccion}
      />
    </div>
  );
}
