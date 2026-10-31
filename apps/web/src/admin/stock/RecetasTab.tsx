import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProductoRecetaItem, RecetaProductoDetalle, InsumoItem } from './tipos';
import { stockApi } from './stockApi';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
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

  // Filtro de lista
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'VENTA' | 'PRODUCCION' | 'SIN_RECETA'>('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Receta seleccionada para visualización en vivo
  const [recetaActivaIdx, setRecetaActivaIdx] = useState(0);
  const [detalleActivo, setDetalleActivo] = useState<RecetaProductoDetalle | null>(null);

  // Modal «Editar receta»
  const [modalRuAbierto, setModalRuAbierto] = useState(false);
  const [ruProductoId, setRuProductoId] = useState<string>('');
  const [ruEsProduccion, setRuEsProduccion] = useState<boolean>(false);
  const [ruRinde, setRuRinde] = useState<string>('1');
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
      const prodItem = productos.find((p) => p.id === targetId);
      const esProd = det.esProduccion ?? prodItem?.esProduccion ?? false;
      const rindeVal = det.rinde ?? prodItem?.rinde ?? 1;

      setRuEsProduccion(esProd);
      setRuRinde(String(rindeVal || 1));

      if (det.tamanos.length > 0 && det.tamanos[0].lineas) {
        setRuLineas(det.tamanos[0].lineas.map((l) => ({ insumoId: l.insumoId, cantidad: l.cantidad })));
      } else {
        setRuLineas([]);
      }
      setModalRuAbierto(true);
    } catch (err: any) {
      setRuMensaje(err.message || 'Error al abrir editor de receta');
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
        es_produccion: ruEsProduccion,
        rinde: ruEsProduccion ? (parseFloat(ruRinde) || 1) : undefined,
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

  // Filtrado de productos para la tabla
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (filtroTipo === 'VENTA' && (!p.tieneReceta || p.esProduccion)) return false;
      if (filtroTipo === 'PRODUCCION' && (!p.tieneReceta || !p.esProduccion)) return false;
      if (filtroTipo === 'SIN_RECETA' && p.tieneReceta) return false;

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(q) ||
          (p.categoriaNombre && p.categoriaNombre.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [productos, filtroTipo, busqueda]);

  const conteos = useMemo(() => {
    let venta = 0;
    let produccion = 0;
    let sinReceta = 0;
    productos.forEach((p) => {
      if (!p.tieneReceta) sinReceta++;
      else if (p.esProduccion) produccion++;
      else venta++;
    });
    return { todos: productos.length, venta, produccion, sinReceta };
  }, [productos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Encabezado y botón */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)', flex: '1 1 280px' }}>
          Qué lleva cada plato, qué insumos descuenta y qué margen deja. Las recetas pueden ser de tipo <strong>"Se vende"</strong> (descuenta al vender) o <strong>"Se prepara por tanda"</strong> (alimenta la producción del día).
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
          {/* Tarjeta de visualización en vivo de la Receta */}
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
                    minHeight: '40px',
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

            {/* Identificador de tipo en la receta activa */}
            <div style={{ padding: '8px 16px', background: 'var(--cp-cream)', borderBottom: '1px solid var(--cp-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                {prodActivo?.nombre}
              </span>
              <div>
                {prodActivo?.esProduccion ? (
                  <span style={{ padding: '4px 10px', borderRadius: 9999, background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12 }}>
                    Se prepara por tanda · Rinde {prodActivo.rinde || 1} unidades
                  </span>
                ) : prodActivo?.tieneReceta ? (
                  <span style={{ padding: '4px 10px', borderRadius: 9999, background: '#e6f5ea', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12 }}>
                    Se vende · Descuenta al vender
                  </span>
                ) : (
                  <span style={{ padding: '4px 10px', borderRadius: 9999, background: 'var(--cp-line)', color: 'var(--cp-soft)', fontWeight: 700, fontSize: 12 }}>
                    Sin receta
                  </span>
                )}
              </div>
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

            {/* Caja crema de resumen financiero */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--cp-cream)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Costo de insumos {prodActivo?.esProduccion ? '(por unidad)' : ''}</span>
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

          {/* Resumen numérico de platos en carta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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

          {/* Filtros de la tabla */}
          <BarraFiltros style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <FiltroCombo
              etiqueta="Mostrar"
              valor={filtroTipo}
              valorPorDefecto="TODOS"
              opciones={[
                { valor: 'TODOS', etiqueta: 'Todos', cantidad: conteos.todos },
                { valor: 'VENTA', etiqueta: 'Se vende', cantidad: conteos.venta },
                { valor: 'PRODUCCION', etiqueta: 'Se prepara por tanda', cantidad: conteos.produccion },
                { valor: 'SIN_RECETA', etiqueta: 'Sin receta', cantidad: conteos.sinReceta },
              ]}
              alCambiar={(v) => setFiltroTipo(v as typeof filtroTipo)}
            />

            <input
              type="search"
              placeholder="Buscar producto o categoría..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                flex: '2 1 220px',
                minWidth: 0,
                minHeight: 38,
                padding: '0 12px',
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-cream)',
                fontSize: 13,
                width: 240,
              }}
            />
          </BarraFiltros>

          {/* Tabla de productos y márgenes */}
          <div className="tabla-tactil-envoltura" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px' }}>
            <table className="tabla-tactil">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Producto</th>
                  <th style={{ width: '120px' }}>Categoría</th>
                  <th style={{ width: '160px' }}>Tipo de receta</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Precio</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Costo</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Margen (S/)</th>
                  <th style={{ textAlign: 'right', width: '90px' }}>Margen (%)</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--cp-sand)' }}>
                    <td style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>{p.nombre}</td>
                    <td style={{ color: 'var(--cp-soft)', fontSize: '12px' }}>{p.categoriaNombre || '—'}</td>
                    <td>
                      {p.esProduccion ? (
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 9999, background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 11 }}>
                          Se prepara por tanda ({p.rinde || 1} und)
                        </span>
                      ) : p.tieneReceta ? (
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 9999, background: '#e6f5ea', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 11 }}>
                          Se vende
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 9999, background: 'var(--cp-line)', color: 'var(--cp-soft)', fontWeight: 700, fontSize: 11 }}>
                          Sin receta
                        </span>
                      )}
                    </td>
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
                          padding: '0 12px',
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

      {/* Modal: «Editar receta» */}
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
              gap: '14px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
                  Editar receta
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginTop: 2 }}>
                  {productos.find((p) => p.id === ruProductoId)?.nombre || 'Producto'}
                </div>
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

            {/* Selector de tipo claro */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--cp-cream)', padding: 12, borderRadius: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Tipo de receta</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRuEsProduccion(false)}
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-navy)',
                    background: !ruEsProduccion ? 'var(--cp-navy)' : 'transparent',
                    color: !ruEsProduccion ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Se vende
                </button>
                <button
                  type="button"
                  onClick={() => setRuEsProduccion(true)}
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-navy)',
                    background: ruEsProduccion ? 'var(--cp-navy)' : 'transparent',
                    color: ruEsProduccion ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Se prepara por tanda
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                {!ruEsProduccion
                  ? 'Descuenta insumos automáticamente al vender cada unidad en caja o delivery.'
                  : 'Alimenta la producción del día en Almacén ("Hoy preparé..."). Se preparan lotes que rinden varias unidades.'}
              </div>

              {ruEsProduccion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>
                    Rinde por tanda (unidades):
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={ruRinde}
                    onChange={(e) => setRuRinde(e.target.value)}
                    style={{
                      width: 90,
                      minHeight: 38,
                      borderRadius: 8,
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 10px',
                      background: 'var(--cp-white)',
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>unidades</span>
                </div>
              )}
            </div>

            {/* Listado de insumos que descuenta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Insumos que componen la receta {ruEsProduccion ? '(por tanda)' : '(por unidad)'}
              </div>
              {ruLineas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                  Aún no has agregado ningún insumo.
                </div>
              ) : (
                ruLineas.map((linea, idx) => {
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
                          minHeight: '40px',
                          borderRadius: '8px',
                          border: '1.5px solid var(--cp-line)',
                          padding: '0 8px',
                          color: 'var(--cp-navy)',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      />
                      <span style={{ width: '50px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {insumoObj?.unidad_receta || insumoObj?.unidad_almacen || 'und'}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarLineaRu(linea.insumoId)}
                        style={{
                          minHeight: '40px',
                          padding: '0 12px',
                          border: '1.5px solid var(--cp-rust)',
                          borderRadius: '8px',
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
                })
              )}
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
                    minHeight: '42px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'var(--cp-white)',
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
                    minHeight: '42px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 8px',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  onClick={agregarLineaRu}
                  style={{
                    minHeight: '42px',
                    padding: '0 14px',
                    borderRadius: '8px',
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
                  minHeight: '48px',
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
                  minHeight: '48px',
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
          mensaje={
            ruEsProduccion
              ? `La receta se guardará como 'Se prepara por tanda' (rinde ${ruRinde} unidades). Alimentará la producción del día.`
              : 'La receta se guardará como \'Se vende\'. Cada venta del producto descontará automáticamente de cocina lo configurado.'
          }
          textoConfirmar="Sí, guardar receta"
          cargando={guardandoRu}
          alConfirmar={guardarRecetaRu}
          alCancelar={() => setConfirmarGuardarRu(false)}
        />
      )}
    </div>
  );
}
