import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { api } from '../../comun/api';

export interface LineaMermaForm {
  id: string;
  insumoId: string;
  insumoNombre: string;
  unidad: string;
  stockActual: number;
  cantidad: string;
  motivo: string;
  motivoDetalle?: string;
  origen: string;
}

export interface ModalMermaProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar?: (lineas: Array<{
    insumoId: string | number;
    insumoNombre: string;
    cantidad: number;
    unidad: string;
    origen: string;
    destino: string;
    motivo: string;
  }>) => Promise<void> | void;
}

export interface InsumoItem {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
}

const MOTIVOS_RAPIDOS = ['Se cayó', 'Vencido', 'Mal preparado', 'Otro'];
const ORIGENES = ['Salados', 'Bebidas', 'Producción'];

export function ModalMerma({ abierto, alCerrar, alGuardar }: ModalMermaProps) {
  const [insumosList, setInsumosList] = useState<InsumoItem[]>([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(false);

  const [lineas, setLineas] = useState<LineaMermaForm[]>([
    {
      id: '1',
      insumoId: '',
      insumoNombre: '',
      unidad: 'unid',
      stockActual: 0,
      cantidad: '',
      motivo: 'Se cayó',
      origen: 'Salados',
    },
  ]);

  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');

  useEffect(() => {
    if (!abierto) return;

    let activo = true;
    setCargandoInsumos(true);
    setMensajeError('');

    api
      .get<any[]>('/admin/stock/insumos')
      .then((res) => {
        if (!activo) return;
        const lista: InsumoItem[] = [];
        if (Array.isArray(res)) {
          for (const item of res) {
            lista.push({
              id: String(item.id),
              nombre: item.nombre,
              unidad: item.unidad_almacen || item.unidad || 'unid',
              stockActual: Number(item.stock_total ?? item.stockActual ?? 0),
            });
          }
        }
        setInsumosList(lista);

        // Inicializar primera línea si no tiene insumo
        if (lista.length > 0) {
          setLineas((prev) =>
            prev.map((l, i) =>
              i === 0 && !l.insumoId
                ? {
                    ...l,
                    insumoId: lista[0].id,
                    insumoNombre: lista[0].nombre,
                    unidad: lista[0].unidad,
                    stockActual: lista[0].stockActual,
                  }
                : l,
            ),
          );
        }
      })
      .catch(() => {
        if (activo) {
          setMensajeError('No se pudieron cargar los insumos de almacén.');
        }
      })
      .finally(() => {
        if (activo) setCargandoInsumos(false);
      });

    return () => {
      activo = false;
    };
  }, [abierto]);

  if (!abierto) return null;

  const agregarLinea = () => {
    const primerInsumo = insumosList[0] || {
      id: '',
      nombre: '',
      unidad: 'unid',
      stockActual: 0,
    };
    const nuevoId = String(Date.now() + Math.random());
    setLineas((prev) => [
      ...prev,
      {
        id: nuevoId,
        insumoId: primerInsumo.id,
        insumoNombre: primerInsumo.nombre,
        unidad: primerInsumo.unidad,
        stockActual: primerInsumo.stockActual,
        cantidad: '',
        motivo: 'Se cayó',
        origen: 'Salados',
      },
    ]);
  };

  const quitarLinea = (id: string) => {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  const cambiarInsumo = (id: string, insumoId: string) => {
    const def = insumosList.find((x) => x.id === insumoId);
    setLineas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        return {
          ...l,
          insumoId,
          insumoNombre: def ? def.nombre : '',
          unidad: def ? def.unidad : 'unid',
          stockActual: def ? def.stockActual : 0,
        };
      }),
    );
    setMensajeError('');
  };

  const cambiarCantidad = (id: string, val: string) => {
    const clean = val.replace(/[^0-9.,]/g, '').replace(/([.,])(?=.*[.,])/g, '');
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, cantidad: clean } : l)),
    );
    setMensajeError('');
  };

  const cambiarMotivo = (id: string, motivo: string) => {
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, motivo } : l)),
    );
  };

  const cambiarMotivoDetalle = (id: string, motivoDetalle: string) => {
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, motivoDetalle } : l)),
    );
  };

  const cambiarOrigen = (id: string, origen: string) => {
    setLineas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, origen } : l)),
    );
  };

  const validarFormulario = () => {
    setMensajeError('');

    if (lineas.length === 0) {
      setMensajeError('Agrega al menos una línea para registrar la merma.');
      return;
    }

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.insumoId) {
        setMensajeError(`Línea ${i + 1}: Selecciona un insumo.`);
        return;
      }
      const q = parseFloat(l.cantidad.replace(',', '.'));
      if (isNaN(q) || q <= 0) {
        setMensajeError(`Línea ${i + 1}: Escribe una cantidad válida mayor que cero.`);
        return;
      }
      if (l.motivo === 'Otro' && (!l.motivoDetalle || !l.motivoDetalle.trim())) {
        setMensajeError(`Línea ${i + 1}: Especifica el motivo en el campo de texto.`);
        return;
      }
    }

    setConfirmando(true);
  };

  const ejecutarGuardar = async () => {
    try {
      setGuardando(true);
      setMensajeError('');

      const lineasProcesadas = lineas.map((l) => {
        const cantNum = parseFloat(l.cantidad.replace(',', '.'));
        const motivoFinal = l.motivo === 'Otro' ? (l.motivoDetalle?.trim() || 'Otro') : l.motivo;
        return {
          insumoId: l.insumoId,
          insumoNombre: l.insumoNombre,
          cantidad: cantNum,
          unidad: l.unidad,
          origen: l.origen || 'Salados',
          destino: `Merma · ${motivoFinal}`,
          motivo: motivoFinal,
        };
      });

      if (alGuardar) {
        await alGuardar(lineasProcesadas);
      } else {
        // Enviar según si es 1 línea o múltiples
        if (lineasProcesadas.length === 1) {
          const l = lineasProcesadas[0];
          await api.post(
            '/admin/almacen/movimientos',
            {
              tipo: 'MERMA',
              insumoId: l.insumoId,
              cantidad: l.cantidad,
              origen: l.origen,
              destino: l.destino,
              motivo: l.motivo,
            },
          );
        } else {
          await api.post(
            '/admin/almacen/movimientos-merma-multiple',
            {
              motivoGlobal: 'Desecho',
              lineas: lineasProcesadas.map((l) => ({
                insumoId: l.insumoId,
                cantidad: l.cantidad,
                origen: l.origen,
                destino: l.destino,
              })),
            },
          );
        }
      }

      setConfirmando(false);
      alCerrar();
    } catch (err: any) {
      setConfirmando(false);
      setMensajeError(err?.response?.data?.mensaje || err?.message || 'Error al registrar merma.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11, 44, 62, 0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar mermas"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream, #FFFDF8)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--cp-navy, #0B2C3D)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                lineHeight: '27px',
              }}
            >
              Registrar mermas
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--cp-soft, #5A6065)',
                marginTop: '4px',
                lineHeight: '18px',
              }}
            >
              Registra pérdidas de insumos por caída, vencimiento, mala preparación u otro motivo.
            </div>
            <div
              data-testid="aviso-merma-productos"
              style={{ fontSize: '13px', marginTop: '6px', fontWeight: 700, color: 'var(--cp-rust, #B5492F)' }}
            >
              La merma de productos (donas, galletas, tajadas) se registra en Apertura del día.{' '}
              <a href="/admin/apertura" style={{ color: 'inherit', textDecoration: 'underline', display: 'inline-block', minHeight: 44, lineHeight: '44px' }}>
                Ir a Apertura del día
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              flex: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {cargandoInsumos && (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            Cargando insumos disponibles...
          </div>
        )}

        {mensajeError && (
          <div
            role="alert"
            style={{
              background: '#FEE2E2',
              border: '1.5px solid #EF4444',
              color: '#991B1B',
              borderRadius: '10px',
              padding: '12px 14px',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {mensajeError}
          </div>
        )}

        {/* Lista de Líneas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {lineas.map((linea, index) => (
            <div
              key={linea.id}
              style={{
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E2D7C3)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--cp-line)',
                  paddingBottom: '8px',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}>
                  Línea {index + 1}
                </span>
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarLinea(linea.id)}
                    aria-label={`Quitar línea ${index + 1}`}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: 'var(--cp-rust)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    Quitar línea
                  </button>
                )}
              </div>

              {/* Insumo + Cantidad + Origen */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Selector de Insumo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor={`insumo-${linea.id}`}
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}
                  >
                    Insumo
                  </label>
                  <select
                    id={`insumo-${linea.id}`}
                    value={linea.insumoId}
                    onChange={(e) => cambiarInsumo(linea.id, e.target.value)}
                    style={{
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-cream)',
                      color: 'var(--cp-navy)',
                      padding: '0 10px',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {insumosList.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} ({ins.unidad})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor={`cant-${linea.id}`}
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}
                  >
                    Cantidad ({linea.unidad})
                  </label>
                  <input
                    id={`cant-${linea.id}`}
                    type="text"
                    inputMode="decimal"
                    value={linea.cantidad}
                    onChange={(e) => cambiarCantidad(linea.id, e.target.value)}
                    placeholder="Ej. 1.5"
                    style={{
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      padding: '0 12px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  />
                </div>

                {/* Origen */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor={`origen-${linea.id}`}
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}
                  >
                    Área de origen
                  </label>
                  <select
                    id={`origen-${linea.id}`}
                    value={linea.origen}
                    onChange={(e) => cambiarOrigen(linea.id, e.target.value)}
                    style={{
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-cream)',
                      color: 'var(--cp-navy)',
                      padding: '0 10px',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    {ORIGENES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Opciones rápidas de motivo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Motivo
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {MOTIVOS_RAPIDOS.map((mot) => {
                    const seleccionado = linea.motivo === mot;
                    return (
                      <button
                        key={mot}
                        type="button"
                        onClick={() => cambiarMotivo(linea.id, mot)}
                        style={{
                          minHeight: '38px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: `1.5px solid ${seleccionado ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
                          background: seleccionado ? 'rgb(253, 236, 232)' : 'var(--cp-cream)',
                          color: seleccionado ? 'var(--cp-rust)' : 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {mot}
                      </button>
                    );
                  })}
                </div>

                {linea.motivo === 'Otro' && (
                  <input
                    type="text"
                    value={linea.motivoDetalle || ''}
                    onChange={(e) => cambiarMotivoDetalle(linea.id, e.target.value)}
                    placeholder="Describe el motivo de la merma..."
                    style={{
                      minHeight: '40px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 12px',
                      fontSize: '13px',
                      color: 'var(--cp-navy)',
                      fontFamily: 'inherit',
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Botón para agregar otra línea */}
        <button
          type="button"
          onClick={agregarLinea}
          style={{
            minHeight: '44px',
            borderRadius: '12px',
            border: '1.5px dashed var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>+ Agregar otra línea</span>
        </button>

        {/* Resumen al pie */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
            Total: {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'} para mermar
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={alCerrar}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-line)',
                background: 'transparent',
                color: 'var(--cp-soft)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={validarFormulario}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '10px',
                border: 0,
                background: 'var(--cp-rust)',
                color: 'var(--cp-white)',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Registrar mermas
            </button>
          </div>
        </div>
      </div>

      {/* Diálogo de Confirmación Sí/No */}
      <Confirmar
        abierto={confirmando}
        titulo="¿Confirmar registro de mermas?"
        mensaje={`Se registrarán ${lineas.length} línea(s) de merma y se descontarán del inventario del local.`}
        textoConfirmar="Sí, registrar mermas"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
