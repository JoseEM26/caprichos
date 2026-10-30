import React, { useState } from 'react';
import { InsumoItem, LugarStockItem } from './tipos';
import { Confirmar } from '../../comun/Confirmar';
import { formatearUnidad, qty1 } from './formato';

interface ModalInsumoProps {
  insumo: InsumoItem | null; // null si es nuevo
  lugares: LugarStockItem[];
  alCerrar: () => void;
  alGuardar: (datos: any) => Promise<void>;
}

export function ModalInsumo({
  insumo,
  lugares,
  alCerrar,
  alGuardar,
}: ModalInsumoProps) {
  const esEdicion = !!insumo;

  const [nombre, setNombre] = useState(insumo?.nombre || '');
  const [unidadCompra, setUnidadCompra] = useState(insumo?.unidad_compra || 'Caja');
  const [unidadAlmacen, setUnidadAlmacen] = useState(insumo?.unidad_almacen || 'L');
  const [unidadReceta, setUnidadReceta] = useState(insumo?.unidad_receta || 'ml');
  const [factorCompra, setFactorCompra] = useState(insumo ? String(insumo.factor_compra) : '12');
  const [factorReceta, setFactorReceta] = useState(insumo ? String(insumo.factor_receta) : '1000');
  const [minimo, setMinimo] = useState(insumo ? String(insumo.minimo) : '5');
  const [intermedio, setIntermedio] = useState(
    insumo?.intermedio != null ? String(insumo.intermedio) : '15',
  );
  const [maximo, setMaximo] = useState(insumo ? String(insumo.maximo) : '40');
  const [costoUnit] = useState(
    insumo?.costo_unit != null ? String(insumo.costo_unit) : '',
  );
  const [lugarConsumoId, setLugarConsumoId] = useState(insumo?.lugar_consumo_id || (lugares[1]?.id || ''));
  const [proveedorA, setProveedorA] = useState(insumo?.proveedor_a || '');
  const [proveedorB, setProveedorB] = useState(insumo?.proveedor_b || '');
  const [proveedorC, setProveedorC] = useState(insumo?.proveedor_c || '');

  const [errorValidacion, setErrorValidacion] = useState('');
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const validarFormulario = () => {
    if (!nombre.trim()) {
      setErrorValidacion('El nombre del insumo es obligatorio');
      return false;
    }
    const min = parseFloat(minimo);
    const mid = intermedio.trim() ? parseFloat(intermedio) : null;
    const max = parseFloat(maximo);

    if (isNaN(min) || isNaN(max) || min < 0 || max <= 0) {
      setErrorValidacion('Los niveles deben ser números válidos y positivos');
      return false;
    }

    if (mid !== null) {
      if (min >= mid || mid >= max) {
        setErrorValidacion('El mínimo debe ser menor que el intermedio y este menor que el máximo');
        return false;
      }
    } else if (min >= max) {
      setErrorValidacion('El mínimo debe ser menor que el máximo');
      return false;
    }

    const provs = [proveedorA, proveedorB, proveedorC].filter((p) => p.trim() !== '' && p !== '—');
    const setProvs = new Set(provs);
    if (setProvs.size < provs.length) {
      setErrorValidacion('Un proveedor no puede repetirse como A, B y C');
      return false;
    }

    setErrorValidacion('');
    return true;
  };

  const solicitarGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (validarFormulario()) {
      setConfirmarGuardar(true);
    }
  };

  const ejecutarGuardar = async () => {
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        unidad_compra: unidadCompra.trim(),
        unidad_almacen: unidadAlmacen.trim(),
        unidad_receta: unidadReceta.trim(),
        factor_compra: parseFloat(factorCompra) || 1,
        factor_receta: parseFloat(factorReceta) || 1,
        minimo: parseFloat(minimo),
        intermedio: intermedio.trim() ? parseFloat(intermedio) : null,
        maximo: parseFloat(maximo),
        costo_unit: costoUnit ? parseFloat(costoUnit) : undefined,
        lugar_consumo_id: lugarConsumoId || undefined,
        proveedor_a: proveedorA.trim() || undefined,
        proveedor_b: proveedorB.trim() || undefined,
        proveedor_c: proveedorC.trim() || undefined,
      };

      await alGuardar(payload);
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(err.message || 'Error al guardar insumo');
    } finally {
      setGuardando(false);
      setConfirmarGuardar(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
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
        aria-label="Ficha del insumo"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1030px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '22px', lineHeight: '27px' }}>
            {esEdicion ? `Ficha: ${insumo.nombre}` : 'Nuevo insumo'}
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
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Un solo lugar por insumo: cómo se compra, cómo se guarda y cómo se usa en las recetas.
        </div>

        <form onSubmit={solicitarGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Nombre y unidad si es nuevo */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <label htmlFor="ins-nombre" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Nombre del insumo
              </label>
              <input
                id="ins-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej.: Harina de trigo"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '42px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <label htmlFor="ins-unidad-alm" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Unidad del almacén (kg, L, unidades)
              </label>
              <input
                id="ins-unidad-alm"
                type="text"
                value={unidadAlmacen}
                onChange={(e) => setUnidadAlmacen(e.target.value)}
                placeholder="kg"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '42px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>

            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <label htmlFor="ins-lugar-consumo" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                Área de preparación
              </label>
              <select
                id="ins-lugar-consumo"
                value={lugarConsumoId}
                onChange={(e) => setLugarConsumoId(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '42px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                <option value="">Seleccione área</option>
                {lugares.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} ({l.tipo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarjeta Unidades y equivalencias idéntica a Admin.dc.html */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontWeight: 800 }}>Unidades y equivalencias</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <label htmlFor="ins-u-compra" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Se compra en (caja, saco)
                </label>
                <input
                  id="ins-u-compra"
                  type="text"
                  value={unidadCompra}
                  onChange={(e) => setUnidadCompra(e.target.value)}
                  placeholder="Saco 5 kg"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <label htmlFor="ins-f-compra" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Cuántas del almacén trae
                </label>
                <input
                  id="ins-f-compra"
                  type="number"
                  step="any"
                  value={factorCompra}
                  onChange={(e) => setFactorCompra(e.target.value)}
                  placeholder="1"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <label htmlFor="ins-u-receta" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Se usa en recetas en (g, ml)
                </label>
                <input
                  id="ins-u-receta"
                  type="text"
                  value={unidadReceta}
                  onChange={(e) => setUnidadReceta(e.target.value)}
                  placeholder="g"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                <label htmlFor="ins-f-receta" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Cuántas de receta hay en 1 del almacén
                </label>
                <input
                  id="ins-f-receta"
                  type="number"
                  step="any"
                  value={factorReceta}
                  onChange={(e) => setFactorReceta(e.target.value)}
                  placeholder="1000"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
              1 {formatearUnidad(unidadCompra) || 'unidad'} = {factorCompra} {formatearUnidad(unidadAlmacen)} · 1 {formatearUnidad(unidadAlmacen)} = {factorReceta} {formatearUnidad(unidadReceta)}
            </div>
          </div>

          {/* Tarjeta Niveles de stock idéntica a Admin.dc.html */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontWeight: 800 }}>Niveles de stock (en la unidad del almacén)</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <label htmlFor="ins-minimo" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Mínimo (rojo)
                </label>
                <input
                  id="ins-minimo"
                  type="number"
                  step="any"
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <label htmlFor="ins-intermedio" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Intermedio (naranja)
                </label>
                <input
                  id="ins-intermedio"
                  type="number"
                  step="any"
                  value={intermedio}
                  onChange={(e) => setIntermedio(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>

              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <label htmlFor="ins-maximo" style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Máximo
                </label>
                <input
                  id="ins-maximo"
                  type="number"
                  step="any"
                  value={maximo}
                  onChange={(e) => setMaximo(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tarjeta Proveedores */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontWeight: 800 }}>Proveedores</div>

            {[
              { letra: 'A', valor: proveedorA, setValor: setProveedorA },
              { letra: 'B', valor: proveedorB, setValor: setProveedorB },
              { letra: 'C', valor: proveedorC, setValor: setProveedorC },
            ].map((prov) => (
              <div key={prov.letra}>
                <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  Proveedor {prov.letra}
                </label>
                <input
                  type="text"
                  value={prov.valor}
                  onChange={(e) => prov.setValor(e.target.value)}
                  placeholder={`Ej.: Proveedor ${prov.letra}`}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Existencias físicas por lugar en la ficha del insumo */}
          {insumo && (
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontWeight: 800 }}>Existencias por lugar físico</div>
              {insumo.stock_por_lugar && insumo.stock_por_lugar.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {insumo.stock_por_lugar.map((spl) => (
                    <div
                      key={spl.lugarId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: 'var(--cp-sand)',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{spl.lugarNombre}</span>
                      <span>
                        <b>{qty1(spl.cantidad)}</b> {formatearUnidad(insumo.unidad_almacen)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px',
                      borderTop: '1px solid var(--cp-line)',
                      fontWeight: 800,
                      fontSize: '14px',
                    }}
                  >
                    <span>Total consolidado</span>
                    <span>
                      {qty1(insumo.stock_total)} {formatearUnidad(insumo.unidad_almacen)}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                  Sin stock registrado en los lugares físicos.
                </div>
              )}
            </div>
          )}

          {/* Lotes y precios */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontWeight: 800 }}>Lotes con vencimiento</div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Sin lotes registrados.</div>
            <div style={{ fontWeight: 800, marginTop: '6px' }}>Últimos precios</div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Aún sin compras registradas.</div>
          </div>

          {errorValidacion && (
            <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
              {errorValidacion}
            </div>
          )}

          {/* Botones de acción del modal idénticos al mockup */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={alCerrar}
              style={{
                flex: 1,
                minHeight: '52px',
                borderRadius: '12px',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Confirmación Sí/No obligatoria */}
      {confirmarGuardar && (
        <Confirmar
          abierto={confirmarGuardar}
          titulo={esEdicion ? `¿Guardar la ficha de ${nombre}?` : `¿Guardar el insumo "${nombre}"?`}
          mensaje="Los niveles de stock y las unidades se usan en Stock, en las compras y en las órdenes de compra."
          textoSi={guardando ? 'Guardando...' : 'Sí, guardar'}
          textoNo="No, cancelar"
          alConfirmar={ejecutarGuardar}
          alCancelar={() => setConfirmarGuardar(false)}
        />
      )}
    </>
  );
}
