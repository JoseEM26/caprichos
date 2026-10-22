import { useState, useEffect, useCallback } from 'react';
import { ProductoRecetaItem, RecetaProductoDetalle, InsumoItem } from './tipos';
import { stockApi } from './stockApi';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { formatearUnidad, qty1 } from './formato';

interface RecetasTabProps {
  insumos: InsumoItem[];
}

export function RecetasTab({ insumos }: RecetasTabProps) {
  const [productos, setProductos] = useState<ProductoRecetaItem[]>([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [platosSinMargen, setPlatosSinMargen] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Receta seleccionada para visualización en vivo (estilo mockup)
  const [recetaActivaIdx, setRecetaActivaIdx] = useState(0);
  const [detalleActivo, setDetalleActivo] = useState<RecetaProductoDetalle | null>(null);

  // Modal «Qué descuenta cada producto» (isRu del mockup)
  const [modalRuAbierto, setModalRuAbierto] = useState(false);
  const [ruProductoId, setRuProductoId] = useState<string>('');
  const [ruLineas, setRuLineas] = useState<Array<{ insumoId: string; cantidad: number }>>([]);
  const [ruInsumoNuevoId, setRuInsumoNuevoId] = useState(insumos[0]?.id || '');
  const [ruCantidadNueva, setRuCantidadNueva] = useState('1');
  const [confirmarGuardarRu, setConfirmarGuardarRu] = useState(false);
  const [guardandoRu, setGuardandoRu] = useState(false);
  const [ruMensaje, setRuMensaje] = useState('');

  const cargarLista = useCallback(async () => {
    try {
      setError(null);
      const datos = await stockApi.listarRecetas();
      setProductos(datos.productos);
      setTotalProductos(datos.totalProductos);
      setPlatosSinMargen(datos.platosSinMargen);

      // Cargar detalle del producto activo si hay productos
      if (datos.productos.length > 0) {
        const prodId = datos.productos[0].id;
        const det = await stockApi.obtenerReceta(prodId);
        setDetalleActivo(det);
        setRuProductoId(prodId);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar recetas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  const seleccionarReceta = async (idx: number) => {
    setRecetaActivaIdx(idx);
    const prod = productos[idx];
    if (prod) {
      try {
        const det = await stockApi.obtenerReceta(prod.id);
        setDetalleActivo(det);
        setRuProductoId(prod.id);
      } catch (err) {
        console.error('Error al cargar detalle de receta:', err);
      }
    }
  };

  const abrirModalRu = async (prodId?: string) => {
    const targetId = prodId || ruProductoId || productos[0]?.id;
    if (!targetId) return;
    setRuProductoId(targetId);
    setRuMensaje('');
    try {
      const det = await stockApi.obtenerReceta(targetId);
      if (det.tamanos.length > 0 && det.tamanos[0].lineas) {
        setRuLineas(det.tamanos[0].lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad })));
      } else {
        setRuLineas([]);
      }
      setModalRuAbierto(true);
    } catch (err: any) {
      alert(err.message || 'Error al abrir editor de receta');
    }
  };

  const agregarLineaRu = () => {
    const cant = parseFloat(ruCantidadNueva);
    if (!ruInsumoNuevoId || isNaN(cant) || cant <= 0) return;
    const existe = ruLineas.find((l) => l.insumoId === ruInsumoNuevoId);
    if (existe) {
      setRuLineas(ruLineas.map((l) => (l.insumoId === ruInsumoNuevoId ? { ...l, cantidad: l.cantidad + cant } : l)));
    } else {
      setRuLineas([...ruLineas, { insumoId: ruInsumoNuevoId, cantidad: cant }]);
    }
  };

  const quitarLineaRu = (insId: string) => {
    setRuLineas(ruLineas.filter((l) => l.insumoId !== insId));
  };

  const guardarRecetaRu = async () => {
    setGuardandoRu(true);
    try {
      await stockApi.guardarReceta(ruProductoId, {
        tamano_valor_id: detalleActivo?.tamanos[0]?.tamanoId || null,
        es_produccion: false,
        rinde: 1,
        lineas: ruLineas.map((l) => ({ insumo_id: l.insumoId, cantidad: l.cantidad })),
      });
      setConfirmarGuardarRu(false);
      setModalRuAbierto(false);
      await cargarLista();
    } catch (err: any) {
      setRuMensaje(err.message || 'Error al guardar receta');
    } finally {
      setGuardandoRu(false);
    }
  };

  const prodActivo = productos[recetaActivaIdx] || productos[0];
  const lineasActivas =
    detalleActivo && detalleActivo.tamanos.length > 0
      ? detalleActivo.tamanos[0].lineas
      : [];

  const costoCalculado = prodActivo?.costo != null ? `s/ ${prodActivo.costo.toFixed(2)}` : 's/ 0.00';
  const precioVenta = prodActivo?.precio != null ? `s/ ${prodActivo.precio.toFixed(2)}` : 's/ 0.00';
  const margenTexto =
    prodActivo?.margenSoles != null && prodActivo?.margenPorcentaje != null
      ? `s/ ${prodActivo.margenSoles.toFixed(2)} · ${prodActivo.margenPorcentaje}%`
      : 'Sin receta';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Encabezado y botón idéntico al mockup */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)', flex: '1 1 280px' }}>
          Qué lleva cada plato, cuánto cuesta y qué margen deja. Cada venta descuenta del stock lo que dice aquí.
        </div>
        <button
          type="button"
          onClick={() => abrirModalRu()}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            border: '1.5px solid var(--cp-navy)',
            borderRadius: '12px',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Editar qué descuenta cada producto
        </button>
      </div>

      {cargando ? (
        <Cargando mensaje="Cargando recetas y costeo..." />
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarLista} />
      ) : productos.length === 0 ? (
        <EstadoVacio
          titulo="No hay recetas registradas"
          mensaje="Ningún producto del catálogo cuenta con receta actualmente."
        />
      ) : (
        <>
          {/* Tarjeta de visualización en vivo de la Receta idéntica al mockup */}
          <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', overflow: 'hidden', flex: 'none' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--cp-line)',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px' }}>
                Receta
              </span>
              {productos.slice(0, 10).map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => seleccionarReceta(i)}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    background: recetaActivaIdx === i ? 'var(--cp-navy)' : 'transparent',
                    color: recetaActivaIdx === i ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {r.nombre}
                </button>
              ))}
            </div>

            {/* Líneas de insumos de la receta */}
            {lineasActivas.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--cp-soft)', fontSize: '13px' }}>
                Este plato no tiene insumos configurados en su receta.
              </div>
            ) : (
              lineasActivas.map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--cp-sand)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <span>{l.insumoNombre}</span>
                  <span style={{ color: 'var(--cp-soft)' }}>
                    {qty1(l.cantidad)} {formatearUnidad(l.unidadReceta)}
                  </span>
                  <span style={{ fontWeight: 700, minWidth: '70px', textAlign: 'right' }}>
                    s/ {l.subtotalCosto.toFixed(2)}
                  </span>
                </div>
              ))
            )}

            {/* Caja crema de resumen financiero idéntica al mockup */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--cp-cream)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Costo de insumos</span>
                <span style={{ fontWeight: 700 }}>{costoCalculado}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Precio de venta</span>
                <span style={{ fontWeight: 700 }}>{precioVenta}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                }}
              >
                <span>Margen</span>
                <span style={{ color: 'var(--cp-rust)' }}>{margenTexto}</span>
              </div>
            </div>
          </div>

          {/* Resumen numérico y listado de platos en carta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '4px' }}>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>TOTAL DE PLATOS EN CARTA</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--cp-navy)', marginTop: '2px' }}>{totalProductos}</div>
            </div>
            <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>SIN RECETA / SIN MARGEN</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: platosSinMargen > 0 ? 'var(--cp-rust)' : 'var(--cp-navy)', marginTop: '2px' }}>
                {platosSinMargen}
              </div>
            </div>
          </div>

          {/* Tabla de productos y márgenes */}
          <div className="tabla-tactil-envoltura" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px' }}>
            <table className="tabla-tactil">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Producto</th>
                  <th style={{ width: '130px' }}>Categoría</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Precio</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Costo</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>Margen (S/)</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Margen (%)</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--cp-sand)' }}>
                    <td style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>{p.nombre}</td>
                    <td style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>{p.categoriaNombre}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>s/ {p.precio.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: p.costo != null ? 'inherit' : 'var(--cp-soft)' }}>
                      {p.costo != null ? `s/ ${p.costo.toFixed(2)}` : 'Sin receta'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: p.margenSoles != null ? 'var(--cp-navy)' : 'var(--cp-soft)' }}>
                      {p.margenSoles != null ? `s/ ${p.margenSoles.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: p.margenPorcentaje != null ? 'var(--cp-rust)' : 'var(--cp-soft)' }}>
                      {p.margenPorcentaje != null ? `${p.margenPorcentaje}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => abrirModalRu(p.id)}
                        style={{
                          minHeight: '34px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal isRu: «Qué descuenta cada producto» idéntico al mockup */}
      {modalRuAbierto && (
        <>
          <div
            onClick={() => setModalRuAbierto(false)}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Qué descuenta cada producto"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(670px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-white)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
                Qué descuenta cada producto
              </div>
              <button
                type="button"
                onClick={() => setModalRuAbierto(false)}
                aria-label="Cerrar"
                style={{ width: '44px', height: '44px', border: 0, background: 'transparent', fontSize: '20px', color: 'var(--cp-navy)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ flex: '1 1 200px' }}>
                {productos.find((p) => p.id === ruProductoId)?.nombre || 'Producto'}
              </b>
            </div>

            <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
              Cantidad que sale del stock por cada unidad vendida, en la unidad del insumo (kg, L, und). Si no cambias nada, se usa el cálculo automático.
            </div>

            {/* Listado de insumos que descuenta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ruLineas.map((linea, idx) => {
                const insumoObj = insumos.find((i) => i.id === linea.insumoId);
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      borderTop: '1px solid var(--cp-line)',
                      paddingTop: '8px',
                    }}
                  >
                    <span style={{ flex: '1 1 140px', fontSize: '14px', fontWeight: 600 }}>
                      {insumoObj?.nombre || 'Insumo'}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={linea.cantidad}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRuLineas(ruLineas.map((l, j) => (j === idx ? { ...l, cantidad: val } : l)));
                      }}
                      style={{
                        width: '84px',
                        boxSizing: 'border-box',
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-line)',
                        padding: '0 8px',
                        color: 'var(--cp-navy)',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ width: '40px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                      {insumoObj?.unidad_receta || insumoObj?.unidad_almacen || 'und'}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarLineaRu(linea.insumoId)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        border: '1.5px solid var(--cp-rust)',
                        borderRadius: '10px',
                        background: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Selector para agregar insumo */}
            <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '10px' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Agregar insumo
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={ruInsumoNuevoId}
                  onChange={(e) => setRuInsumoNuevoId(e.target.value)}
                  style={{
                    flex: '1 1 180px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 10px',
                    fontSize: '13px',
                  }}
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad_almacen})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  value={ruCantidadNueva}
                  onChange={(e) => setRuCantidadNueva(e.target.value)}
                  placeholder="Cantidad"
                  style={{
                    width: '90px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 8px',
                    textAlign: 'center',
                  }}
                />
                <button
                  type="button"
                  onClick={agregarLineaRu}
                  style={{
                    minHeight: '44px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-sand)',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  + Agregar
                </button>
              </div>
            </div>

            {ruMensaje && (
              <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                {ruMensaje}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmarGuardarRu(true)}
                style={{
                  flex: '1 1 160px',
                  minHeight: '52px',
                  border: 0,
                  borderRadius: '12px',
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: 'pointer',
                }}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setModalRuAbierto(false)}
                style={{
                  minHeight: '52px',
                  padding: '0 16px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmación Sí/No antes de guardar */}
      {confirmarGuardarRu && (
        <Confirmar
          abierto={confirmarGuardarRu}
          titulo="¿Guardar cambios en la receta?"
          mensaje="Cada venta del producto descontará del stock lo configurado."
          textoSi={guardandoRu ? 'Guardando...' : 'Sí, guardar'}
          textoNo="No, cancelar"
          alConfirmar={guardarRecetaRu}
          alCancelar={() => setConfirmarGuardarRu(false)}
        />
      )}
    </div>
  );
}
