import { useState, useMemo } from 'react';
import {
  ProductoCarta,
  TamanoCarta as TamanoProducto,
  OpcionCarta as OpcionProducto,
  GrupoOpcionesCarta as GrupoOpciones,
} from '../../../carta/tipos';

export interface ConfiguracionUnidad {
  opciones: OpcionProducto[];
  nombreVaso: string;
}

export interface ProductoConfigurado {
  producto: ProductoCarta;
  tamano: TamanoProducto | null;
  cantidad: number;
  nota: string;
  opcionesGlobales: OpcionProducto[];
  unidades: ConfiguracionUnidad[];
  precioUnitario: number;
  precioTotal: number;
}

export interface VentanaOpcionesProductoProps {
  producto: ProductoCarta | null;
  alCerrar: () => void;
  alAgregar: (config: ProductoConfigurado) => void;
}

export function VentanaOpcionesProducto({
  producto,
  alCerrar,
  alAgregar,
}: VentanaOpcionesProductoProps) {
  if (!producto) return null;

  // Variantes / Tamaños
  const tamanos = producto.tamanos || [];
  const [tamanoSeleccionado, setTamanoSeleccionado] = useState<TamanoProducto | null>(
    tamanos.length > 0 ? tamanos[0] : null,
  );

  // Cantidad total
  const [cantidad, setCantidad] = useState(1);

  // Modo DT-62 (personalización por unidad)
  const [personalizarPorUnidad, setPersonalizarPorUnidad] = useState(false);
  const [unidadActualIdx, setUnidadActualIdx] = useState(0);

  // Opciones seleccionadas por unidad (o globales si !personalizarPorUnidad)
  const [opcionesPorUnidad, setOpcionesPorUnidad] = useState<Record<number, OpcionProducto[]>>({
    0: [],
  });

  // Nombres de stickers para bebidas
  const [nombresPorUnidad, setNombresPorUnidad] = useState<Record<number, string>>({
    0: '',
  });

  // Nota de cocina
  const [notaCocina, setNotaCocina] = useState('');

  // Búsqueda en grupos
  const [busquedaGrupo, setBusquedaGrupo] = useState<Record<string, string>>({});

  // Categorías de bebidas
  const esBebida = useMemo(() => {
    const cat = (producto as any).categoria?.nombre || (producto as any).categoriaId || '';
    const norm = cat.toLowerCase();
    return (
      norm.includes('frappe') ||
      norm.includes('iced') ||
      norm.includes('frozen') ||
      norm.includes('caliente') ||
      norm.includes('bebida') ||
      norm.includes('café') ||
      norm.includes('cafe')
    );
  }, [producto]);

  const precioBase = tamanoSeleccionado ? tamanoSeleccionado.precio : producto.precio || 0;

  // Obtener opciones de la unidad actual
  const opcionesActuales = opcionesPorUnidad[personalizarPorUnidad ? unidadActualIdx : 0] || [];

  // Alternar opción
  const alternarOpcion = (grupo: GrupoOpciones, opcion: OpcionProducto) => {
    const idx = personalizarPorUnidad ? unidadActualIdx : 0;
    const lista = opcionesPorUnidad[idx] || [];
    const yaSeleccionada = lista.some((o) => o.id === opcion.id);

    let nuevaLista: OpcionProducto[];
    if ((grupo as any).tipo === 'RADIO' || grupo.maximo === 1) {
      // Reemplazar opción de este grupo
      const grupoOpcionIds = new Set(grupo.opciones.map((o: OpcionProducto) => o.id));
      nuevaLista = lista.filter((o) => !grupoOpcionIds.has(o.id));
      if (!yaSeleccionada) {
        nuevaLista.push(opcion);
      }
    } else {
      if (yaSeleccionada) {
        nuevaLista = lista.filter((o) => o.id !== opcion.id);
      } else {
        const opcionesDeEsteGrupo = lista.filter((o) =>
          grupo.opciones.some((go: OpcionProducto) => go.id === o.id),
        );
        if (grupo.maximo && opcionesDeEsteGrupo.length >= grupo.maximo) {
          return;
        }
        nuevaLista = [...lista, opcion];
      }
    }

    setOpcionesPorUnidad((prev) => ({
      ...prev,
      [idx]: nuevaLista,
    }));
  };

  // Calcular precio de una unidad
  const calcularPrecioUnidad = (idx: number) => {
    const opts = opcionesPorUnidad[idx] || [];
    const extra = opts.reduce((acc, o) => acc + (Number(o.precioExtra || 0)), 0);
    return precioBase + extra;
  };

  // Precio total
  const precioTotal = useMemo(() => {
    if (!personalizarPorUnidad) {
      const opts = opcionesPorUnidad[0] || [];
      const extra = opts.reduce((acc, o) => acc + (Number(o.precioExtra || 0)), 0);
      return (precioBase + extra) * cantidad;
    }
    let total = 0;
    for (let i = 0; i < cantidad; i++) {
      total += calcularPrecioUnidad(i);
    }
    return total;
  }, [precioBase, cantidad, personalizarPorUnidad, opcionesPorUnidad]);

  // Validar selecciones obligatorias
  const gruposFaltantes = useMemo(() => {
    const faltantes: string[] = [];
    const grupos = producto.grupos || [];
    for (const g of grupos) {
      if (g.obligatorio || (g.minimo && g.minimo > 0)) {
        const minReq = g.minimo || 1;
        const seleccionadas = opcionesActuales.filter((o) =>
          g.opciones.some((go) => go.id === o.id),
        );
        if (seleccionadas.length < minReq) {
          faltantes.push(g.nombre);
        }
      }
    }
    return faltantes;
  }, [producto, opcionesActuales]);

  const puedeAgregar = gruposFaltantes.length === 0;

  const handleAgregar = () => {
    if (!puedeAgregar) return;

    const unidades: ConfiguracionUnidad[] = [];
    if (personalizarPorUnidad) {
      for (let i = 0; i < cantidad; i++) {
        unidades.push({
          opciones: opcionesPorUnidad[i] || [],
          nombreVaso: nombresPorUnidad[i] || '',
        });
      }
    } else {
      for (let i = 0; i < cantidad; i++) {
        unidades.push({
          opciones: opcionesPorUnidad[0] || [],
          nombreVaso: nombresPorUnidad[i] || nombresPorUnidad[0] || '',
        });
      }
    }

    alAgregar({
      producto,
      tamano: tamanoSeleccionado,
      cantidad,
      nota: notaCocina.trim(),
      opcionesGlobales: opcionesPorUnidad[0] || [],
      unidades,
      precioUnitario: precioTotal / cantidad,
      precioTotal,
    });
    alCerrar();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Opciones del producto"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Fondo oscuro */}
      <div
        onClick={alCerrar}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 65,
          background: 'rgba(11, 44, 62, 0.6)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          zIndex: 70,
          width: 'min(760px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.45)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
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
                fontSize: '20px',
                lineHeight: '26px',
                color: 'var(--cp-navy)',
              }}
            >
              {producto.nombre}
            </div>
            {producto.descripcion && (
              <div
                style={{
                  fontSize: '13px',
                  lineHeight: '18px',
                  color: 'var(--cp-soft)',
                }}
              >
                {producto.descripcion}
              </div>
            )}
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

        {/* Variantes / Tamaños */}
        {tamanos.length > 0 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--cp-navy)' }}>
              Tamaño o presentación
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tamanos.map((v) => {
                const activo = tamanoSeleccionado?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTamanoSeleccionado(v)}
                    style={{
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-navy)',
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {v.nombre} · S/ {Number(v.precio || 0).toFixed(2)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Grupos de opciones */}
        {(producto.grupos || []).map((g) => {
          const qBuscada = (busquedaGrupo[g.id] || '').toLowerCase().trim();
          const opcionesVisibles = qBuscada
            ? g.opciones.filter((o) => o.nombre.toLowerCase().includes(qBuscada))
            : g.opciones;

          const reqTexto = g.obligatorio
            ? 'Obligatorio · elige 1'
            : g.maximo
            ? `Opcional · hasta ${g.maximo}`
            : 'Opcional';

          return (
            <div key={g.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>{g.nombre}</span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{reqTexto}</span>
              </div>

              {g.opciones.length > 8 && (
                <input
                  type="search"
                  value={busquedaGrupo[g.id] || ''}
                  onChange={(e) =>
                    setBusquedaGrupo((prev) => ({ ...prev, [g.id]: e.target.value }))
                  }
                  placeholder={`Buscar en ${g.nombre.toLowerCase()}`}
                  aria-label={`Buscar en ${g.nombre}`}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 14px',
                    fontSize: '13px',
                    marginBottom: '6px',
                  }}
                />
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '6px',
                }}
              >
                {opcionesVisibles.map((o) => {
                  const elegida = opcionesActuales.some((op) => op.id === o.id);
                  const extraNum = Number(o.precioExtra || 0);
                  const mark = elegida ? '[✓]' : '[ ]';

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => alternarOpcion(g, o)}
                      style={{
                        minHeight: '44px',
                        padding: '0 10px',
                        borderRadius: '10px',
                        border: elegida
                          ? '1.5px solid var(--cp-orange)'
                          : '1.5px solid var(--cp-line)',
                        background: elegida ? '#FFF1E8' : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                        fontSize: '13px',
                        lineHeight: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      <span aria-hidden="true" style={{ fontWeight: 800 }}>
                        {mark}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {o.nombre}
                      </span>
                      {extraNum > 0 && (
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--cp-rust)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          + S/ {extraNum.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Nombres para stickers si es bebida */}
        {esBebida && (
          <div
            style={{
              border: '1.5px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'var(--cp-white)',
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>
              Nombre para la etiqueta de cada bebida
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Sale en grande en el sticker del vaso (acta 03). Si se deja vacío, va el nombre del cliente.
            </div>
            {Array.from({ length: personalizarPorUnidad ? 1 : cantidad }).map((_, i) => {
              const k = personalizarPorUnidad ? unidadActualIdx : i;
              return (
                <label key={k} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Ingresa el nombre de la persona que tomará esta bebida ({k + 1} de {cantidad})
                  <input
                    type="text"
                    value={nombresPorUnidad[k] || ''}
                    onChange={(e) =>
                      setNombresPorUnidad((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    placeholder="Ej.: Lucía"
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      marginTop: '4px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-cream)',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}

        {/* Nota para cocina */}
        <div>
          <label
            htmlFor="cfg-note"
            style={{ fontWeight: 800, display: 'block', marginBottom: '6px', color: 'var(--cp-navy)' }}
          >
            Nota para cocina
          </label>
          <input
            id="cfg-note"
            type="text"
            value={notaCocina}
            onChange={(e) => setNotaCocina(e.target.value)}
            placeholder="Ejemplo: sin hielo"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Advertencia si faltan opciones obligatorias */}
        {gruposFaltantes.length > 0 && (
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            Falta elegir: {gruposFaltantes.join(', ')}.
          </div>
        )}

        {/* DT-62: Personalización por unidad */}
        {cantidad > 1 && (producto.grupos || []).length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPersonalizarPorUnidad(!personalizarPorUnidad);
              setUnidadActualIdx(0);
            }}
            style={{
              minHeight: '44px',
              border: '1.5px dashed var(--cp-navy)',
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {personalizarPorUnidad
              ? '✓ Opciones distintas por unidad activadas'
              : 'Elegir opciones distintas para cada unidad'}
          </button>
        )}

        {personalizarPorUnidad && cantidad > 1 && (
          <div
            role="status"
            style={{
              background: '#FFF6E3',
              border: '1.5px solid var(--cp-gold)',
              borderRadius: '10px',
              padding: '8px 10px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>
              Unidad {unidadActualIdx + 1} de {cantidad}: elige sus opciones (mismo tamaño).
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {Array.from({ length: cantidad }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setUnidadActualIdx(idx)}
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--cp-navy)',
                    background:
                      unidadActualIdx === idx ? 'var(--cp-navy)' : 'var(--cp-white)',
                    color:
                      unidadActualIdx === idx ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pie: Stepper de cantidad y Botón Agregar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                if (cantidad > 1) {
                  setCantidad((c) => c - 1);
                  if (unidadActualIdx >= cantidad - 1) {
                    setUnidadActualIdx(Math.max(0, cantidad - 2));
                  }
                }
              }}
              aria-label="Menos cantidad"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                fontWeight: 800,
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <b style={{ minWidth: '24px', textAlign: 'center', fontSize: '16px' }}>
              {cantidad}
            </b>
            <button
              type="button"
              onClick={() => setCantidad((c) => c + 1)}
              aria-label="Más cantidad"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                fontWeight: 800,
                fontSize: '20px',
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAgregar}
            disabled={!puedeAgregar}
            style={{
              flex: '1 1 200px',
              minHeight: '52px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              opacity: puedeAgregar ? 1 : 0.5,
              cursor: puedeAgregar ? 'pointer' : 'not-allowed',
            }}
          >
            <span>Agregar al pedido</span>
            <span> · S/ {precioTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
