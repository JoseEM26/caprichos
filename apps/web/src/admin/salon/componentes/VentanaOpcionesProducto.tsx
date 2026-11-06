import { useState, useMemo, useEffect } from 'react';
import '../salon.css';
import {
  ProductoCarta,
  TamanoCarta as TamanoProducto,
  OpcionCarta as OpcionProducto,
  GrupoOpcionesCarta as GrupoOpciones,
} from '../../../carta/tipos';
import type { OfertaItem } from '../../ofertas/ofertasApi';
import { alternarEleccion } from '../../../carta/eleccionGrupo';
import { SelectorSaboresMezcla } from '../../../comun/SelectorSaboresMezcla';
import { Reparto, aArreglo, faltanUnidades, recortarAlTope, repartoValido } from '../../../comun/saboresMezcla';
import {
  AvisoAlternativasCombo,
  eleccionesCombo,
  faltaElegirJuguetes,
  faltaElegirReemplazo,
  notaReemplazos,
  partesConAlternativas,
  partesEleccion,
  ResumenPartesFijas,
  repartoAlternativa,
  usosDeSabor,
} from '../../../carta/ReemplazoCombo';
import { SelectorEleccionCombo } from '../../../carta/SelectorEleccionCombo';
import { etiquetaUltimos, infoStockDe, topeAgregable, topeTamano } from '../../../carta/stock';
import { maximoMezclas } from '../../../comun/saboresMezcla';

export interface ConfiguracionUnidad {
  opciones: OpcionProducto[];
  nombreVaso: string;
}

export interface ProductoConfigurado {
  producto: ProductoCarta;
  tamano: TamanoProducto | null;
  cantidad: number;
  nota: string;
  /** Combo con parte fija: el combo y lo elegido en cada parte (principal o reemplazo) */
  ofertaId?: string;
  comboElecciones?: { parteId: string; productoId: string }[];
  opcionesGlobales: OpcionProducto[];
  unidades: ConfiguracionUnidad[];
  /** Combo con bebidas: un nombre de envase por bebida (unidad 1: bebida 1, bebida 2...; vacío si no se escribe) */
  nombresBebidas?: string[];
  /** Mezcla de sabores: unidades por media docena o docena y cuántas de cada sabor */
  unidadesPorMezcla?: number;
  sabores?: { saborId: string; cantidad: number; nombre?: string }[];
  precioUnitario: number;
  precioTotal: number;
}

export interface VentanaOpcionesProductoProps {
  producto: ProductoCarta | null;
  alCerrar: () => void;
  alAgregar: (config: ProductoConfigurado) => void;
  /** Combo vinculado al producto: avisa si una parte fija se agotó y ofrece reemplazos */
  oferta?: OfertaItem | null;
  /** Unidades de este producto que ya van en el pedido (todas sus líneas): descuentan del saldo */
  enCarrito?: number;
}

const recortar = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function VentanaOpcionesProducto({
  producto,
  alCerrar,
  alAgregar,
  oferta = null,
  enCarrito = 0,
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

  // Combo: reemplazos de partes fijas agotadas
  const partesRe = useMemo(() => partesConAlternativas(oferta), [oferta]);
  // Sin alternativa elegida al inicio: el cliente la escoge (no se asigna sola)
  const [reemplazos, setReemplazos] = useState<Record<string, string>>({});
  const comboAgotado = oferta?.disponible === false;
  // Partes A_ELECCION con lista (juguetes): cuántas de cada opción; el total depende de la cantidad del combo
  const partesJug = useMemo(() => partesEleccion(oferta, reemplazos), [oferta, reemplazos]);
  const [juguetes, setJuguetes] = useState<Record<string, Reparto>>({});

  // Nota de cocina
  const [notaCocina, setNotaCocina] = useState('');

  // Mezcla de sabores (donas y galletas): el reparto se recorta al total y al stock de cada sabor
  const [valorSabores, setValorSabores] = useState<Reparto>({});
  const saborMode = producto.saboresConStock === true;
  // Con stock por sabor, los grupos obligatorios heredados («Sabor» de empanadas) no se muestran ni se exigen
  const gruposVisibles = useMemo(
    () => (saborMode ? (producto.grupos || []).filter((g) => !(g.obligatorio || (g.minimo && g.minimo > 0))) : producto.grupos || []),
    [producto, saborMode],
  );
  const unidadesMezcla = tamanoSeleccionado?.unidades ?? 1;
  const total = unidadesMezcla * cantidad;
  const saboresDisp = (producto.sabores ?? []).map((s) => ({ id: s.id, nombre: s.nombre, disponible: s.disponible, quedan: s.quedan ?? null }));
  const valorSaboresOk = saborMode ? recortarAlTope(valorSabores, saboresDisp, total) : {};
  useEffect(() => {
    if (saborMode && JSON.stringify(valorSaboresOk) !== JSON.stringify(valorSabores)) setValorSabores(valorSaboresOk);
  });
  const saboresListos = !saborMode || repartoValido(valorSaboresOk, total, saboresDisp);
  // Stock sin sabores: cada tamaño consume sus unidades (1/2 docena = 6); el tope son las que quedan menos el pedido
  const infoStock = infoStockDe(producto);
  const libres = topeAgregable(infoStock, enCarrito);
  // Con sabores, el tope son las mezclas que caben en lo que queda de cada sabor (ya descontado lo de otras líneas)
  const tamanoSinStock = (unidades: number) => (saborMode ? maximoMezclas(saboresDisp, unidades) === 0 : libres !== null && unidades > libres);
  const tope = saborMode ? maximoMezclas(saboresDisp, unidadesMezcla) : topeTamano(infoStock, enCarrito, unidadesMezcla);
  const tamanoNoCabe = tamanos.length > 0 && tope === 0;
  const enTopeStock = tope !== null && cantidad >= tope;
  const franjaUltimos = infoStock.quedan !== 0 ? etiquetaUltimos(infoStock) : null;
  useEffect(() => {
    if (tope !== null && cantidad > Math.max(1, tope)) setCantidad(Math.max(1, tope));
  }, [tope, cantidad]);

  // Búsqueda en grupos
  const [busquedaGrupo, setBusquedaGrupo] = useState<Record<string, string>>({});

  // Bebidas del combo (grupos «Bebida 1 · Bebida»): cada una lleva su nombre de envase, opcional
  const gruposBebida = useMemo(
    () => (producto.grupos || []).filter((g) => g.nombre.includes(' · ') && /^bebida/i.test(g.nombre.split(' · ')[1].trim())),
    [producto],
  );
  const nB = gruposBebida.length;
  const [nombresCombo, setNombresCombo] = useState<Record<number, string>>({});

  // Categorías de bebidas
  const esBebida = useMemo(() => {
    if (gruposBebida.length > 0) return false;
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
  }, [producto, gruposBebida]);

  const precioBase = tamanoSeleccionado ? tamanoSeleccionado.precio : producto.precio || 0;

  // Obtener opciones de la unidad actual
  const opcionesActuales = opcionesPorUnidad[personalizarPorUnidad ? unidadActualIdx : 0] || [];

  // Alternar opción
  const alternarOpcion = (grupo: GrupoOpciones, opcion: OpcionProducto) => {
    const idx = personalizarPorUnidad ? unidadActualIdx : 0;
    const lista = opcionesPorUnidad[idx] || [];

    // Elegidas de este grupo; la regla de elección vive en alternarEleccion (igual que la carta)
    const deEsteGrupo = (o: OpcionProducto) => grupo.opciones.some((go: OpcionProducto) => go.id === o.id);
    const reglas = (grupo as any).tipo === 'RADIO' ? { minimo: grupo.minimo, maximo: 1 } : grupo;
    const nuevas = alternarEleccion(reglas, lista.filter(deEsteGrupo).map((o) => o.id), opcion.id);
    const nuevaLista: OpcionProducto[] = [
      ...lista.filter((o) => !deEsteGrupo(o)),
      ...grupo.opciones.filter((go: OpcionProducto) => nuevas.includes(go.id)),
    ];

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
    for (const g of gruposVisibles) {
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
  }, [gruposVisibles, opcionesActuales]);

  const puedeAgregar =
    gruposFaltantes.length === 0 &&
    !comboAgotado &&
    (tope === null || (tope > 0 && cantidad <= tope)) &&
    !faltaElegirReemplazo(partesRe, reemplazos) &&
    !faltaElegirJuguetes(partesJug, juguetes, cantidad) &&
    saboresListos;

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

    const elecciones = eleccionesCombo(oferta, reemplazos, juguetes);
    alAgregar({
      producto,
      ...(saborMode
        ? {
            unidadesPorMezcla: unidadesMezcla,
            sabores: aArreglo(valorSaboresOk).map((s) => ({ ...s, nombre: saboresDisp.find((x) => x.id === s.saborId)?.nombre })),
          }
        : {}),
      ...(oferta && elecciones.length > 0 ? { ofertaId: String(oferta.id), comboElecciones: elecciones } : {}),
      tamano: tamanoSeleccionado,
      cantidad,
      nota: [notaReemplazos(partesRe, reemplazos), notaCocina.trim()].filter(Boolean).join(' · '),
      opcionesGlobales: opcionesPorUnidad[0] || [],
      unidades,
      ...(nB > 0 ? { nombresBebidas: Array.from({ length: cantidad * nB }, (_, i) => (nombresCombo[i] ?? '').trim()) } : {}),
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
        {franjaUltimos && (
          <div data-testid="ultimos-ventana" style={{ alignSelf: 'flex-start', background: 'var(--cp-rust)', color: '#FFFFFF', fontWeight: 800, fontSize: '13px', borderRadius: '9999px', padding: '4px 14px' }}>
            {franjaUltimos}
          </div>
        )}

        {tamanos.length > 0 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--cp-navy)' }}>
              Tamaño o presentación
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tamanos.map((v) => {
                const activo = tamanoSeleccionado?.id === v.id;
                const noCabe = tamanoSinStock(v.unidades ?? 1);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTamanoSeleccionado(v)}
                    disabled={noCabe}
                    style={{
                      minHeight: '44px',
                      padding: noCabe ? '4px 14px' : '0 14px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-navy)',
                      background: activo && !noCabe ? 'var(--cp-navy)' : 'transparent',
                      color: activo && !noCabe ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      opacity: noCabe ? 0.5 : 1,
                      cursor: noCabe ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {v.nombre} · S/ {Number(v.precio || 0).toFixed(2)}
                    {noCabe && (
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                        {libres && libres > 0 ? `Solo quedan ${libres}` : 'No hay stock suficiente'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {saborMode && (
          <SelectorSaboresMezcla sabores={saboresDisp} total={total} valor={valorSaboresOk} onCambio={setValorSabores} />
        )}

        {/* Grupos de opciones */}
        {gruposVisibles.map((g) => {
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

        {nB > 0 && (
          <div style={{ border: '1.5px solid var(--cp-line)', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--cp-white)' }}>
            <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>Nombre para el envase</div>
            {Array.from({ length: cantidad * nB }, (_, i) => {
              const g = gruposBebida[i % nB];
              const elegidas = opcionesPorUnidad[personalizarPorUnidad ? Math.floor(i / nB) : 0] || [];
              const bebida = g.opciones.find((o) => elegidas.some((e) => e.id === o.id))?.nombre ?? g.nombre.split(' · ')[1];
              return (
                <label key={i} style={{ fontSize: '12px', fontWeight: 700, display: 'block', color: 'var(--cp-soft)' }}>
                  {`${bebida} · Nombre para el envase (opcional, máx. 14 letras se ven completas)`}
                  <input
                    type="text"
                    value={nombresCombo[i] ?? ''}
                    onChange={(e) => setNombresCombo((prev) => ({ ...prev, [i]: e.target.value }))}
                    placeholder="Ej.: Lucía o Mesa 4"
                    maxLength={30}
                    style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: '42px', marginTop: '4px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', background: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: '14px' }}
                  />
                </label>
              );
            })}
          </div>
        )}

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

        {comboAgotado && (
          <div role="status" style={{ fontWeight: 800, color: 'var(--cp-rust)' }}>
            Agotado
          </div>
        )}
        {!comboAgotado && <ResumenPartesFijas oferta={oferta} />}
        <AvisoAlternativasCombo
          partes={comboAgotado ? [] : partesRe}
          elegidos={reemplazos}
          onElegir={(parteId, alt) => {
            setReemplazos((prev) => ({ ...prev, [parteId]: alt.id }));
            setJuguetes((prev) => ({ ...prev, [parteId]: repartoAlternativa(alt) }));
          }}
        />
        {!comboAgotado &&
          partesJug.map((parte) => (
            <SelectorEleccionCombo
              key={parte.parteId}
              parte={parte}
              unidades={cantidad}
              valor={juguetes[parte.parteId] ?? {}}
              onCambio={(v) => setJuguetes((prev) => ({ ...prev, [parte.parteId]: v }))}
              usos={usosDeSabor([], juguetes)}
            />
          ))}

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
        {saborMode && !saboresListos && (
          <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            Elige los sabores: faltan {faltanUnidades(valorSaboresOk, total)}
          </div>
        )}

        {/* DT-62: Personalización por unidad */}
        {cantidad > 1 && (producto.grupos || []).length > 0 && !saborMode && (
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
              onClick={() => setCantidad((c) => (enTopeStock ? c : c + 1))}
              disabled={enTopeStock}
              aria-label="Más cantidad"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                fontWeight: 800,
                fontSize: '20px',
                opacity: enTopeStock ? 0.35 : 1,
                cursor: enTopeStock ? 'not-allowed' : 'pointer',
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
            <span>
              {comboAgotado
                ? 'Agotado'
                : tamanoNoCabe
                  ? 'No hay stock suficiente'
                  : saborMode && !saboresListos
                    ? 'Elige los sabores'
                    : 'Agregar al pedido'}
            </span>
            <span> · S/ {precioTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
