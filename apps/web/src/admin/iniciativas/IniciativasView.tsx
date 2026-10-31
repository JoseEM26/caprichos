import { useEffect, useState, useTransition } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import {
  listarIniciativas,
  crearIniciativa,
  comentarIniciativa,
  cambiarEstadoIniciativa,
  type IniciativaItem,
  type ConteosIniciativas,
} from './iniciativasApi';
import { NuevaIniciativaModal } from './NuevaIniciativaModal';
import { FotoIniciativa } from './FotoIniciativa';
import { VisorCapturaModal } from './VisorCapturaModal';
import { FiltroCombo } from '../../comun/FiltroCombo';

const COLOR_TIPO: Record<string, string> = {
  QUEJA: '#BA1A1A',
  MEJORA: '#2F7D4F',
  IDEA: '#E05A1B',
};

const ESTILO_ESTADO: Record<string, { bg: string; fg: string }> = {
  NUEVA: { bg: '#FFF6E3', fg: '#9A6700' },
  EN_REVISION: { bg: '#EBF3FB', fg: '#0B2C3E' },
  HECHA: { bg: '#EAF6ED', fg: '#14502B' },
  NO_POR_AHORA: { bg: '#F0F0F0', fg: '#6B7280' },
};

export function IniciativasView() {
  const { usuario } = useSesion();
  const [, startTransition] = useTransition();

  const [iniciativas, setIniciativas] = useState<IniciativaItem[]>([]);
  const [conteos, setConteos] = useState<ConteosIniciativas>({
    total: 0,
    nuevas: 0,
    enRevision: 0,
    hechas: 0,
    noPorAhora: 0,
    quejas: 0,
    mejoras: 0,
    ideas: 0,
  });
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [soloMias, setSoloMias] = useState<boolean>(false);

  // Estados de acordeón
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  // Textos de nuevo comentario por iniciativa
  const [comentariosTexto, setComentariosTexto] = useState<Record<string, string>>({});
  const [enviandoComentario, setEnviandoComentario] = useState<Record<string, boolean>>({});

  // Modal nueva iniciativa
  const [modalNuevaAbierto, setModalNuevaAbierto] = useState<boolean>(false);

  // Confirmar cambio de estado
  const [confirmarEstado, setConfirmarEstado] = useState<{
    iniciativaId: string;
    iniciativaTitulo: string;
    nuevoEstado: string;
    etiquetaEstado: string;
  } | null>(null);

  // Visor de captura ampliada
  const [capturaAmpliada, setCapturaAmpliada] = useState<{
    url: string;
    titulo: string;
    codigo: string;
  } | null>(null);

  const cargarDatos = async () => {
    try {
      setError('');
      const res = await listarIniciativas({
        busqueda: busqueda.trim() || undefined,
        tipo: filtroTipo,
        estado: filtroEstado,
        soloMias,
      });
      setConteos(res.conteos);
      setIniciativas(res.elementos);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar iniciativas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      cargarDatos();
    });
  }, [busqueda, filtroTipo, filtroEstado, soloMias]);

  const toggleAbierta = (id: string) => {
    setAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCrearIniciativa = async (datos: {
    tipo: string;
    area: string;
    titulo: string;
    detalle: string;
    archivoId?: string | null;
  }) => {
    await crearIniciativa(datos);
    await cargarDatos();
  };

  const handleComentar = async (id: string) => {
    const texto = (comentariosTexto[id] || '').trim();
    if (!texto) return;

    setEnviandoComentario((prev) => ({ ...prev, [id]: true }));
    try {
      const nuevoComentario = await comentarIniciativa(id, texto);
      setIniciativas((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                comentarios: [...item.comentarios, nuevoComentario],
                totalComentarios: item.totalComentarios + 1,
              }
            : item,
        ),
      );
      setComentariosTexto((prev) => ({ ...prev, [id]: '' }));
    } catch (err: any) {
      alert(err?.message || 'Error al enviar comentario');
    } finally {
      setEnviandoComentario((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleEjecutarCambioEstado = async () => {
    if (!confirmarEstado) return;
    try {
      const res = await cambiarEstadoIniciativa(
        confirmarEstado.iniciativaId,
        confirmarEstado.nuevoEstado,
      );
      setIniciativas((prev) =>
        prev.map((item) =>
          item.id === confirmarEstado.iniciativaId
            ? {
                ...item,
                estado: res.estado,
                estadoTexto: res.estadoTexto,
              }
            : item,
        ),
      );
      setConfirmarEstado(null);
      await cargarDatos();
    } catch (err: any) {
      alert(err?.message || 'Error al cambiar de estado');
    }
  };

  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Aquí cualquiera del equipo sube una queja, una mejora o una idea, con su captura y su comentario. Todos pueden verlas y comentar; cada una dice quién la subió. El administrador las revisa y les cambia el estado. Todo queda en el Historial de acciones.
      </div>

      {/* Tarjetas de resumen (contadores dinámicos) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Iniciativas</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>
            {conteos.total}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>subidas por el equipo</span>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Nuevas</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>
            {conteos.nuevas}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>esperan revisión</span>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>En revisión</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>
            {conteos.enRevision}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>se están viendo</span>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>Hechas</span>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}>
            {conteos.hechas}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>ya resueltas</span>
        </div>
      </div>

      {/* Botón nueva iniciativa y buscador */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setModalNuevaAbierto(true)}
          style={{
            minHeight: '48px',
            padding: '0 20px',
            border: 0,
            borderRadius: '12px',
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          + Nueva iniciativa
        </button>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <label htmlFor="in-q" style={{ position: 'absolute', left: '-9999px' }}>
            Buscar iniciativas
          </label>
          <input
            id="in-q"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, texto o persona"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-line)',
              padding: '0 18px',
              fontSize: '14px',
              background: 'var(--cp-white)',
              color: 'var(--cp-navy)',
            }}
          />
        </div>
      </div>

      {/* Filtros en combo: tipo, estado y responsable */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <FiltroCombo
          etiqueta="Tipo"
          valor={filtroTipo}
          valorPorDefecto="TODOS"
          opciones={[
            { valor: 'TODOS', etiqueta: 'Todas', cantidad: conteos.total },
            { valor: 'QUEJA', etiqueta: 'Quejas', cantidad: conteos.quejas },
            { valor: 'MEJORA', etiqueta: 'Mejoras', cantidad: conteos.mejoras },
            { valor: 'IDEA', etiqueta: 'Ideas', cantidad: conteos.ideas },
          ]}
          alCambiar={(v) => setFiltroTipo(v)}
        />
        <FiltroCombo
          etiqueta="Estado"
          valor={filtroEstado}
          valorPorDefecto="TODOS"
          opciones={[
            { valor: 'TODOS', etiqueta: 'Todos' },
            { valor: 'NUEVA', etiqueta: 'Nueva', cantidad: conteos.nuevas },
            { valor: 'EN_REVISION', etiqueta: 'En revisión', cantidad: conteos.enRevision },
            { valor: 'HECHA', etiqueta: 'Hecha', cantidad: conteos.hechas },
            { valor: 'NO_POR_AHORA', etiqueta: 'No por ahora', cantidad: conteos.noPorAhora },
          ]}
          alCambiar={(v) => setFiltroEstado(v)}
        />
        <FiltroCombo
          etiqueta="Ver"
          valor={soloMias ? 'mias' : 'todas'}
          valorPorDefecto="todas"
          opciones={[
            { valor: 'todas', etiqueta: 'Todas' },
            { valor: 'mias', etiqueta: 'Solo las mías' },
          ]}
          alCambiar={(v) => setSoloMias(v === 'mias')}
        />
      </div>

      {/* Contador de resultados */}
      <div style={{ fontSize: '13px', fontWeight: 700 }}>
        {iniciativas.length} {iniciativas.length === 1 ? 'iniciativa' : 'iniciativas'}
      </div>

      {cargando && <Cargando mensaje="Cargando iniciativas…" />}

      {error && (
        <div style={{ padding: '14px', background: '#FDECE8', color: 'var(--cp-rust)', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {!cargando && iniciativas.length === 0 && (
        <div style={{ padding: '18px', textAlign: 'center', color: 'var(--cp-soft)', fontSize: '14px' }}>
          No hay iniciativas con estos filtros.
        </div>
      )}

      {/* Lista de tarjetas */}
      {iniciativas.map((item) => {
        const abierta = !!abiertas[item.id];
        const colorStripe = COLOR_TIPO[item.tipo] || 'var(--cp-orange)';
        const estiloEst = ESTILO_ESTADO[item.estado] || { bg: 'var(--cp-sand)', fg: 'var(--cp-navy)' };
        const comTexto = comentariosTexto[item.id] || '';
        const enviando = !!enviandoComentario[item.id];

        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              gap: '10px',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '12px',
              background: 'var(--cp-white)',
            }}
          >
            <span
              style={{
                flex: '0 0 auto',
                width: '6px',
                borderRadius: '3px',
                background: colorStripe,
              }}
            />
            <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '15px', lineHeight: '20px', overflowWrap: 'anywhere', minWidth: 0, flex: '1 1 220px' }}>
                  {item.titulo}
                </span>
                <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '9999px',
                      padding: '3px 8px',
                      border: `1.5px solid ${colorStripe}`,
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {item.tipoTexto}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '9999px',
                      padding: '3px 8px',
                      background: estiloEst.bg,
                      color: estiloEst.fg,
                    }}
                  >
                    {item.estadoTexto}
                  </span>
                </span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', overflowWrap: 'anywhere' }}>
                Subida por <b>{item.autor.nombre} ({item.autor.rol}) · {item.fechaTexto}</b> · {item.codigo} · {item.areaTexto}
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {item.fotoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setCapturaAmpliada({
                        url: item.fotoUrl!,
                        titulo: item.titulo,
                        codigo: item.codigo,
                      })
                    }
                    title="Clic para ver captura en grande"
                    aria-label={`Ver captura de ${item.codigo}`}
                    style={{
                      flex: 'none',
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                      borderRadius: '10px',
                      display: 'inline-block',
                    }}
                  >
                    <FotoIniciativa
                      src={item.fotoUrl}
                      alt={`Captura de ${item.codigo}`}
                      style={{
                        width: '96px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        border: '1px solid var(--cp-line)',
                        display: 'block',
                      }}
                    />
                  </button>
                )}
                <div style={{ flex: '1 1 200px', minWidth: 0, fontSize: '14px', lineHeight: '20px', overflowWrap: 'anywhere' }}>
                  {item.detalle}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => toggleAbierta(item.id)}
                  style={{
                    minHeight: '40px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '9999px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {abierta ? 'Cerrar' : 'Ver y comentar'}
                </button>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {item.totalComentarios} {item.totalComentarios === 1 ? 'comentario' : 'comentarios'}
                </span>
              </div>

              {/* Detalle ampliado y comentarios */}
              {abierta && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--cp-line)', paddingTop: '10px' }}>
                  {item.fotoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setCapturaAmpliada({
                          url: item.fotoUrl!,
                          titulo: item.titulo,
                          codigo: item.codigo,
                        })
                      }
                      title="Clic para ver captura en grande"
                      aria-label={`Ver captura ampliada de ${item.codigo}`}
                      style={{
                        width: 'fit-content',
                        maxWidth: '100%',
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        borderRadius: '12px',
                        display: 'block',
                      }}
                    >
                      <FotoIniciativa
                        src={item.fotoUrl}
                        alt={`Captura ampliada de ${item.codigo}`}
                        style={{
                          width: '100%',
                          maxWidth: '520px',
                          maxHeight: '360px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid var(--cp-line)',
                          display: 'block',
                        }}
                      />
                    </button>
                  )}

                  {/* Acciones de estado (solo administrador) */}
                  {esAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)' }}>
                        CAMBIAR ESTADO (solo administrador)
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {item.estado !== 'EN_REVISION' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmarEstado({
                                iniciativaId: item.id,
                                iniciativaTitulo: item.titulo,
                                nuevoEstado: 'EN_REVISION',
                                etiquetaEstado: 'En revisión',
                              })
                            }
                            style={{
                              minHeight: '40px',
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: '9999px',
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Pasar a En revisión
                          </button>
                        )}
                        {item.estado !== 'HECHA' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmarEstado({
                                iniciativaId: item.id,
                                iniciativaTitulo: item.titulo,
                                nuevoEstado: 'HECHA',
                                etiquetaEstado: 'Hecha',
                              })
                            }
                            style={{
                              minHeight: '40px',
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: '9999px',
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Marcar como Hecha
                          </button>
                        )}
                        {item.estado !== 'NO_POR_AHORA' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmarEstado({
                                iniciativaId: item.id,
                                iniciativaTitulo: item.titulo,
                                nuevoEstado: 'NO_POR_AHORA',
                                etiquetaEstado: 'No por ahora',
                              })
                            }
                            style={{
                              minHeight: '40px',
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: '9999px',
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            No por ahora
                          </button>
                        )}
                        {item.estado !== 'NUEVA' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmarEstado({
                                iniciativaId: item.id,
                                iniciativaTitulo: item.titulo,
                                nuevoEstado: 'NUEVA',
                                etiquetaEstado: 'Nueva',
                              })
                            }
                            style={{
                              minHeight: '40px',
                              padding: '0 12px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: '9999px',
                              background: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Volver a Nueva
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Comentarios previos */}
                  {item.comentarios.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {item.comentarios.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            borderRadius: '10px',
                            background: 'var(--cp-sand)',
                            padding: '8px 10px',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                            {c.autor.nombre} ({c.autor.rol}) · {c.fechaTexto}
                          </div>
                          <div style={{ fontSize: '14px', lineHeight: '19px', overflowWrap: 'anywhere' }}>
                            {c.texto}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario nuevo comentario */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor={`in-c-${item.id}`} style={{ fontSize: '13px', fontWeight: 700 }}>
                      Tu comentario
                    </label>
                    <textarea
                      id={`in-c-${item.id}`}
                      rows={2}
                      maxLength={400}
                      value={comTexto}
                      onChange={(e) =>
                        setComentariosTexto((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Escribe aquí"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius: '12px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        padding: '10px 12px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => handleComentar(item.id)}
                        disabled={enviando || !comTexto.trim()}
                        style={{
                          minHeight: '44px',
                          padding: '0 16px',
                          border: 0,
                          borderRadius: '10px',
                          background: 'var(--cp-navy)',
                          color: 'var(--cp-cream)',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {enviando ? 'Comentando…' : 'Comentar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Modal Nueva Iniciativa */}
      <NuevaIniciativaModal
        abierto={modalNuevaAbierto}
        alCerrar={() => setModalNuevaAbierto(false)}
        alGuardar={handleCrearIniciativa}
      />

      {/* Modal Confirmar Cambio de Estado (RN-CAP-015) */}
      <Confirmar
        abierto={!!confirmarEstado}
        titulo={`¿Pasar a ${confirmarEstado?.etiquetaEstado}?`}
        mensaje={`La iniciativa "${confirmarEstado?.iniciativaTitulo}" cambiará a estado ${confirmarEstado?.etiquetaEstado}.`}
        textoSi="Sí, cambiar"
        textoNo="No, cancelar"
        alConfirmar={handleEjecutarCambioEstado}
        alCancelar={() => setConfirmarEstado(null)}
      />

      {/* Visor de Captura Ampliada */}
      <VisorCapturaModal
        abierto={!!capturaAmpliada}
        fotoUrl={capturaAmpliada?.url || null}
        titulo={capturaAmpliada?.titulo}
        codigo={capturaAmpliada?.codigo}
        alCerrar={() => setCapturaAmpliada(null)}
      />
    </div>
  );
}
