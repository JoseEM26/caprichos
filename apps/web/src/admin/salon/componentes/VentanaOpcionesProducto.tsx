import { useState, useMemo } from 'react';
import '../salon.css';
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

const recortar = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

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
  const [avisoNombres, setAvisoNombres] = useState(false);

  // Nota de cocina
  const [notaCocina, setNotaCocina] = useState('');

  // Búsqueda en grupos
  const [busquedaGrupo, setBusquedaGrupo] = useState<Record<string, string>>({});

  // Categorías de bebidas
  const esBebida = useMemo(() => {
    const cat = [
      (producto as any).categoria?.nombre,
      (producto as any).categoriaNombre,
      (producto as any).categoriaId,
      producto.nombre,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (
      cat.includes('frappe') ||
      cat.includes('iced') ||
      cat.includes('frozen') ||
      cat.includes('caliente') ||
      cat.includes('bebida') ||
      cat.includes('café') ||
      cat.includes('cafe') ||
      cat.includes('jugo') ||
      cat.includes('infusi') ||
      cat.includes('chocolate')
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

  // En las bebidas el nombre de quien la toma es obligatorio: va en la etiqueta del vaso
  const nombresFaltantes = esBebida
    ? Array.from({ length: cantidad }, (_, k) => k).filter((k) => !(nombresPorUnidad[k] ?? '').trim())
    : [];

  const handleAgregar = () => {
    if (!puedeAgregar) return;

    if (nombresFaltantes.length > 0) {
      setAvisoNombres(true);
      const campo = document.getElementById(`nombre-bebida-${nombresFaltantes[0]}`);
      campo?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      campo?.focus();
      return;
    }

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
      className="salon-overlay"
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
        className="salon-panel"
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

          const esUnica = (g as any).tipo === 'RADIO' || g.maximo === 1;
          const reqTexto = g.obligatorio
            ? 'Obligatorio · elige 1'
            : g.maximo
            ? `Opcional · hasta ${g.maximo}`
            : 'Opcional';

          const seleccionadasGrupo = opcionesActuales.filter((op) =>
            g.opciones.some((go) => go.id === op.id),
          );

          return (
            <div key={g.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                    {g.nombre}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      background: g.obligatorio ? '#FDE8E4' : '#EFE6D5',
                      color: g.obligatorio ? 'var(--cp-rust)' : 'var(--cp-soft)',
                    }}
                  >
                    {g.obligatorio ? 'OBLIGATORIO' : 'OPCIONAL'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
                  {reqTexto}
                </span>
              </div>

              {seleccionadasGrupo.length > 0 && (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--cp-teal)',
                    marginBottom: '6px',
                  }}
                >
                  Elegido: {seleccionadasGrupo.map((s) => s.nombre).join(', ')}
                </div>
              )}

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

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => alternarOpcion(g, o)}
                      aria-pressed={elegida}
                      style={{
                        minHeight: '44px',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        border: elegida
                          ? '2px solid var(--cp-orange)'
                          : '1.5px solid var(--cp-line)',
                        background: elegida ? '#FFF1E8' : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: elegida ? 700 : 600,
                        lineHeight: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 'none',
                          width: '18px',
                          height: '18px',
                          borderRadius: esUnica ? '50%' : '5px',
                          border: elegida
                            ? esUnica
                              ? '5px solid var(--cp-orange)'
                              : '2px solid var(--cp-orange)'
                            : '2px solid var(--cp-navy)',
                          background:
                            elegida && !esUnica ? 'var(--cp-orange)' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 900,
                          boxSizing: 'border-box',
                        }}
                      >
                        {!esUnica && elegida ? '✓' : ''}
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

        {/* ¿Para quién es?: una etiqueta simulada por cada bebida, como en la carta (el nombre es obligatorio) */}
        {esBebida && (
          <div
            style={{
              border: '1.5px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'var(--cp-white)',
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>¿Para quién es?</div>
            {Array.from({ length: cantidad }, (_, k) => (
              <div key={k} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label
                  style={{ flex: '1 1 150px', minWidth: 0, fontSize: '12px', fontWeight: 700, display: 'block', color: 'var(--cp-soft)' }}
                >
                  {`Ingresa el nombre de la persona que tomará esta bebida${cantidad > 1 ? ` (${k + 1} de ${cantidad})` : ''} *`}
                  <input
                    type="text"
                    id={`nombre-bebida-${k}`}
                    value={nombresPorUnidad[k] || ''}
                    onChange={(e) =>
                      setNombresPorUnidad((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    placeholder="Ej.: Lucía o Mesa 4"
                    maxLength={30}
                    aria-invalid={avisoNombres && !(nombresPorUnidad[k] ?? '').trim()}
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      marginTop: '4px',
                      borderRadius: '10px',
                      border: `1.5px solid ${avisoNombres && !(nombresPorUnidad[k] ?? '').trim() ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
                      background: 'var(--cp-cream)',
                      color: 'var(--cp-navy)',
                      padding: '0 10px',
                      fontSize: '14px',
                    }}
                  />
                </label>
                <div
                  aria-label={`Así se verá la etiqueta del vaso ${k + 1}`}
                  style={{
                    flex: 'none',
                    width: '158px',
                    fontFamily: "'Courier New', monospace",
                    fontSize: '10px',
                    lineHeight: '13px',
                    color: '#111',
                    background: '#fff',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(11,44,62,0.14)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--cp-navy)',
                      color: 'var(--cp-cream)',
                      padding: '2px 8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                    }}
                  >
                    <span>{`BEBIDA ${k + 1}`}</span>
                    <span>ETIQUETA</span>
                  </div>
                  <div style={{ padding: '5px 8px' }}>
                    <div
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '17px',
                        lineHeight: '20px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {recortar((nombresPorUnidad[k] || '').trim() || 'TU NOMBRE', 14)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                        fontSize: '11px',
                        lineHeight: '14px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {recortar(producto.nombre, 18)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {avisoNombres && nombresFaltantes.length > 0 ? (
              <div
                role="alert"
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: 700,
                  color: 'var(--cp-rust)',
                  background: 'var(--cp-sand)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                Escribe el nombre de quien tomará cada bebida. Va en la etiqueta del vaso.
              </div>
            ) : (
              <div style={{ fontSize: '11px', lineHeight: '14px', color: 'var(--cp-soft)' }}>
                Obligatorio: el nombre va en la etiqueta del vaso.
              </div>
            )}
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
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              <button
                type="button"
                onClick={() => {
                  const baseOpts = opcionesPorUnidad[unidadActualIdx] || [];
                  setOpcionesPorUnidad((prev) => {
                    const next = { ...prev };
                    for (let i = 0; i < cantidad; i++) {
                      next[i] = [...baseOpts];
                    }
                    return next;
                  });
                }}
                style={{
                  minHeight: '32px',
                  padding: '0 10px',
                  borderRadius: '16px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Copiar a todas
              </button>
            </div>
          </div>
        )}

        {/* Pie: Stepper de cantidad y Botón Agregar */}
        <div
          className="salon-pie-fijo"
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
