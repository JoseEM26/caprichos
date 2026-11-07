import { useEffect, useState, useMemo } from 'react';
import type { AgotadoItem, DuracionAgotado, ItemCartaBuscable } from './cocinaTipos';
import {
  agotarElemento,
  buscarItemsDeCarta,
  listarAgotados,
  reactivarAgotado,
} from './cocinaApi';
import { Confirmar } from '../../comun/Confirmar';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { EstadoError } from '../../comun/EstadoError';
import { useSesion } from '../../comun/sesion';
import { useTiempoReal } from '../../comun/socket';
import { textosOrigenAgotado } from '../catalogo/origenAgotado';

export interface ModalAgotadosProps {
  abierto: boolean;
  alCerrar: () => void;
}

interface CategoriaAgrupada {
  id: string;
  nombre: string;
  items: ItemCartaBuscable[];
}

export function ModalAgotados({ abierto, alCerrar }: ModalAgotadosProps) {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [itemsCarta, setItemsCarta] = useState<ItemCartaBuscable[]>([]);
  const [agotadosVigentes, setAgotadosVigentes] = useState<AgotadoItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expansión de sabores/opciones por productoId
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  // Item seleccionado para elegir duración o confirmar agotado
  const [itemParaDuracion, setItemParaDuracion] = useState<ItemCartaBuscable | null>(null);
  const [itemParaAgotar, setItemParaAgotar] = useState<{
    item: ItemCartaBuscable;
    duracion: DuracionAgotado;
  } | null>(null);
  const [guardandoAgotado, setGuardandoAgotado] = useState(false);

  // Item para reactivar
  const [itemParaReactivar, setItemParaReactivar] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [guardandoReactivar, setGuardandoReactivar] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [carta, agotados] = await Promise.all([
        buscarItemsDeCarta(),
        listarAgotados(),
      ]);
      setItemsCarta(carta);
      setAgotadosVigentes(agotados);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar carta o agotados');
    } finally {
      setCargando(false);
    }
  };

  // Otro dispositivo marcó o reactivó un agotado: se actualiza la lista con el modal abierto
  useTiempoReal(['carta:disponibilidad'], () => {
    if (abierto) listarAgotados().then(setAgotadosVigentes).catch(() => {});
  });

  useEffect(() => {
    if (abierto) {
      setTerminoBusqueda('');
      setCategoriaFiltro('todas');
      setExpandidos({});
      setItemParaDuracion(null);
      setItemParaAgotar(null);
      setItemParaReactivar(null);
      cargarDatos();
    }
  }, [abierto]);

  // Mapa de agotados por clave tipo-id
  const mapaAgotados = useMemo(() => {
    const mapa = new Map<string, AgotadoItem>();
    for (const ag of agotadosVigentes) {
      const tipo = ag.tipo;
      const targetId = ag.productoId || ag.producto_id || ag.saborId || ag.sabor_id || ag.opcionId || ag.opcion_id || ag.id;
      if (targetId) {
        mapa.set(`${tipo}-${targetId}`, ag);
      }
    }
    return mapa;
  }, [agotadosVigentes]);

  // Solo productos principales para agrupar (los sabores/opciones van anidados dentro de su producto)
  const productosPrincipales = useMemo(() => {
    return itemsCarta.filter((it) => it.tipo === 'PRODUCTO');
  }, [itemsCarta]);

  // Lista de categorías únicas para filtros rápidos
  const categoriasDisponibles = useMemo(() => {
    const nombres = new Set<string>();
    productosPrincipales.forEach((p) => {
      if (p.categoriaNombre) nombres.add(p.categoriaNombre);
    });
    return Array.from(nombres);
  }, [productosPrincipales]);

  // Filtrado de productos por búsqueda y categoría
  const productosFiltrados = useMemo(() => {
    const q = terminoBusqueda.trim().toLowerCase();
    return productosPrincipales.filter((prod) => {
      if (categoriaFiltro !== 'todas' && prod.categoriaNombre !== categoriaFiltro) {
        return false;
      }
      if (!q) return true;
      const coincideNombre = prod.nombre.toLowerCase().includes(q);
      const coincideCategoria = prod.categoriaNombre?.toLowerCase().includes(q);
      const coincideSabor = prod.sabores?.some((s) => s.nombre.toLowerCase().includes(q));
      const coincideOpcion = prod.opciones?.some((o) => o.nombre.toLowerCase().includes(q));
      return coincideNombre || coincideCategoria || coincideSabor || coincideOpcion;
    });
  }, [productosPrincipales, categoriaFiltro, terminoBusqueda]);

  // Agrupación por categoría
  const categoriasAgrupadas = useMemo(() => {
    const mapa = new Map<string, ItemCartaBuscable[]>();
    for (const prod of productosFiltrados) {
      const cat = prod.categoriaNombre || 'Otras categorías';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(prod);
    }
    const agrupadas: CategoriaAgrupada[] = [];
    mapa.forEach((items, nombre) => {
      agrupadas.push({
        id: nombre,
        nombre,
        items,
      });
    });
    return agrupadas;
  }, [productosFiltrados]);

  const toggleExpandir = (prodId: string) => {
    setExpandidos((prev) => ({
      ...prev,
      [prodId]: !prev[prodId],
    }));
  };

  const ejecutarAgotar = async () => {
    if (!itemParaAgotar) return;
    try {
      setGuardandoAgotado(true);
      await agotarElemento({
        tipo: itemParaAgotar.item.tipo,
        id: itemParaAgotar.item.id,
        duracion: itemParaAgotar.duracion,
      });
      setItemParaAgotar(null);
      setItemParaDuracion(null);
      const actualizados = await listarAgotados();
      setAgotadosVigentes(actualizados);
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar como agotado');
      setItemParaAgotar(null);
    } finally {
      setGuardandoAgotado(false);
    }
  };

  const ejecutarReactivar = async () => {
    if (!itemParaReactivar) return;
    try {
      setGuardandoReactivar(true);
      await reactivarAgotado(itemParaReactivar.id);
      setItemParaReactivar(null);
      const actualizados = await listarAgotados();
      setAgotadosVigentes(actualizados);
    } catch (err: any) {
      setError(err?.message || 'No se pudo reactivar el elemento');
      setItemParaReactivar(null);
    } finally {
      setGuardandoReactivar(false);
    }
  };

  const renderHoraRegreso = (ag: AgotadoItem) => {
    if (ag.duracion === 'HOY' || ag.alcance === 'HOY') {
      if (ag.hasta) {
        try {
          const d = new Date(ag.hasta);
          const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `Vuelve mañana (${hora})`;
        } catch {
          return 'Vuelve mañana a medianoche';
        }
      }
      return 'Vuelve mañana a medianoche';
    }
    return 'Hasta reactivación manual';
  };

  if (!abierto) return null;

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
        aria-label="Marcar agotado"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(920px, calc(100% - 24px))',
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
              Marcar agotado
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--cp-soft, #5A6065)',
                marginTop: '4px',
                lineHeight: '18px',
              }}
            >
              El cliente ya no podrá pedirlo en la carta ni en el chatbot. Puedes reactivarlo antes desde esta lista.
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

        {error && <EstadoError mensaje={error} alReintentar={cargarDatos} />}

        {/* Buscador opcional */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="buscar-producto-input"
            style={{
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--cp-navy)',
            }}
          >
            Buscar producto
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="buscar-producto-input"
              type="text"
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              placeholder="Filtro opcional (ej.: lúcuma, club, dona...)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line, #E2D7C3)',
                background: 'var(--cp-white, #FFFFFF)',
                padding: '0 12px',
                fontFamily: 'inherit',
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            />
            {terminoBusqueda && (
              <button
                type="button"
                onClick={() => setTerminoBusqueda('')}
                aria-label="Limpiar búsqueda"
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 0,
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--cp-soft)',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Filtro por categoría (combo) */}
        {categoriasDisponibles.length > 0 && (
          <BarraFiltros>
            <FiltroCombo
              etiqueta="Categoría"
              valor={categoriaFiltro}
              valorPorDefecto="todas"
              opciones={[
                { valor: 'todas', etiqueta: 'Todas' },
                ...categoriasDisponibles.map((cat) => ({ valor: cat, etiqueta: cat })),
              ]}
              alCambiar={setCategoriaFiltro}
            />
          </BarraFiltros>
        )}

        {/* Modal/panel de selección de duración al pulsar Agotado */}
        {itemParaDuracion && (
          <div
            role="region"
            aria-label="Seleccionar duración de agotado"
            style={{
              background: 'var(--cp-white)',
              border: '2px solid var(--cp-rust)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 24px rgba(179, 58, 58, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>
                ¿Por cuánto tiempo se agota «{itemParaDuracion.nombre}»?
              </div>
              <button
                type="button"
                onClick={() => setItemParaDuracion(null)}
                style={{
                  background: 'transparent',
                  border: 0,
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: 'var(--cp-soft)',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {/* Opción 1: Hoy a medianoche */}
              <button
                type="button"
                onClick={() => {
                  setItemParaAgotar({
                    item: itemParaDuracion,
                    duracion: 'HOY',
                  });
                }}
                style={{
                  minHeight: '64px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-rust)',
                  background: 'rgb(253, 236, 232)',
                  color: 'var(--cp-rust)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '13px' }}>Agotar hoy</div>
                <div style={{ fontSize: '12px', color: 'var(--cp-navy)', opacity: 0.9 }}>
                  Hasta hoy a medianoche: vuelve solo mañana
                </div>
              </button>

              {/* Opción 2: Hasta que yo lo reactive (exclusivo ADMIN) */}
              {esAdmin && (
                <button
                  type="button"
                  data-testid="boton-hasta-reactivar"
                  onClick={() => {
                    setItemParaAgotar({
                      item: itemParaDuracion,
                      duracion: 'HASTA_REACTIVAR',
                    });
                  }}
                  style={{
                    minHeight: '64px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-sand, #F7F3EB)',
                    color: 'var(--cp-navy)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '13px' }}>Agotar hasta reactivar</div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Hasta que yo lo reactive
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lista de productos agrupada por categoría */}
        {cargando && itemsCarta.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '20px 0', textAlign: 'center' }}>
            Cargando carta y productos...
          </div>
        ) : categoriasAgrupadas.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '20px 0', textAlign: 'center' }}>
            No se encontraron productos coincidentes.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categoriasAgrupadas.map((cat) => (
              <div
                key={cat.id}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
              >
                {/* Cabecera de Categoría */}
                <div
                  style={{
                    background: 'var(--cp-sand, #F7F3EB)',
                    padding: '10px 16px',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: 'var(--cp-navy)',
                    borderBottom: '1px solid var(--cp-line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{cat.nombre}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-soft)' }}>
                    {cat.items.length} {cat.items.length === 1 ? 'producto' : 'productos'}
                  </span>
                </div>

                {/* Filas de productos */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {cat.items.map((prod, idx) => {
                    const agotadoObj = mapaAgotados.get(`PRODUCTO-${prod.id}`);
                    const estaAgotado = Boolean(agotadoObj);
                    const estaExpandido = Boolean(expandidos[prod.id]);
                    const tieneVariantes =
                      (prod.sabores && prod.sabores.length > 0) ||
                      (prod.opciones && prod.opciones.length > 0);

                    return (
                      <div
                        key={prod.id}
                        style={{
                          borderBottom: idx === cat.items.length - 1 ? 'none' : '1px solid var(--cp-line)',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: estaAgotado ? 'rgb(254, 245, 243)' : 'transparent',
                        }}
                      >
                        {/* Fila principal del producto */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            minHeight: '48px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Miniatura + Nombre */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px', minWidth: 0 }}>
                            {/* Miniatura foto o letra inicial */}
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '10px',
                                background: 'var(--cp-sand, #F7F3EB)',
                                border: '1px solid var(--cp-line)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '18px',
                                color: 'var(--cp-navy)',
                                overflow: 'hidden',
                                flexShrink: 0,
                              }}
                            >
                              {prod.fotoUrl ? (
                                <img
                                  src={prod.fotoUrl}
                                  alt={prod.nombre}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                prod.nombre.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: '14px',
                                  lineHeight: '18px',
                                  color: 'var(--cp-navy)',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {prod.nombre}
                              </div>
                              {prod.precio !== undefined && (
                                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                                  S/ {Number(prod.precio).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Estado y Botón/Switch */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              flexShrink: 0,
                              flexWrap: 'wrap',
                            }}
                          >
                            {tieneVariantes && (
                              <button
                                type="button"
                                onClick={() => toggleExpandir(prod.id)}
                                aria-expanded={estaExpandido}
                                style={{
                                  minHeight: '40px',
                                  padding: '0 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--cp-line)',
                                  background: 'var(--cp-cream)',
                                  color: 'var(--cp-navy)',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {estaExpandido ? '▲ Ocultar variantes' : '▼ Sabores y opciones'}
                              </button>
                            )}

                            {estaAgotado ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--cp-rust)',
                                    color: 'var(--cp-white)',
                                  }}
                                >
                                  Agotado · {renderHoraRegreso(agotadoObj!)}
                                </span>
                                <span
                                  style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-soft)' }}
                                  title={textosOrigenAgotado(agotadoObj!.origen).ayuda}
                                >
                                  {textosOrigenAgotado(agotadoObj!.origen).corto}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemParaReactivar({
                                      id: agotadoObj!.id,
                                      nombre: prod.nombre,
                                    })
                                  }
                                  style={{
                                    minHeight: '44px',
                                    padding: '0 14px',
                                    borderRadius: '10px',
                                    border: '1.5px solid var(--cp-navy)',
                                    background: 'var(--cp-white)',
                                    color: 'var(--cp-navy)',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reactivar
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  aria-label={`Agotar hoy ${prod.nombre}`}
                                  onClick={() => {
                                    setItemParaAgotar({
                                      item: prod,
                                      duracion: 'HOY',
                                    });
                                  }}
                                  style={{
                                    minHeight: '44px',
                                    padding: '0 12px',
                                    borderRadius: '10px',
                                    border: '1.5px solid var(--cp-rust)',
                                    background: 'rgb(253, 236, 232)',
                                    color: 'var(--cp-rust)',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  <span>Agotar hoy</span>
                                </button>

                                {esAdmin && (
                                  <button
                                    type="button"
                                    data-testid="boton-hasta-reactivar"
                                    aria-label={`Agotar hasta reactivar ${prod.nombre}`}
                                    onClick={() => {
                                      setItemParaAgotar({
                                        item: prod,
                                        duracion: 'HASTA_REACTIVAR',
                                      });
                                    }}
                                    style={{
                                      minHeight: '44px',
                                      padding: '0 12px',
                                      borderRadius: '10px',
                                      border: '1.5px solid var(--cp-navy)',
                                      background: 'transparent',
                                      color: 'var(--cp-navy)',
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Agotar hasta reactivar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Variantes expandidas (Sabores y Opciones) */}
                        {tieneVariantes && estaExpandido && (
                          <div
                            style={{
                              marginTop: '6px',
                              paddingLeft: '56px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              borderLeft: '2px dashed var(--cp-line)',
                            }}
                          >
                            {/* Sabores */}
                            {prod.sabores && prod.sabores.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>
                                  SABORES
                                </div>
                                {prod.sabores.map((sab) => {
                                  const sabAgotado = mapaAgotados.get(`SABOR-${sab.id}`);
                                  return (
                                    <div
                                      key={sab.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: sabAgotado ? 'rgb(254, 245, 243)' : 'var(--cp-sand, #F7F3EB)',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                      }}
                                    >
                                      <span style={{ fontWeight: 700 }}>{sab.nombre}</span>
                                      {sabAgotado ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 800 }}>
                                            Agotado
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setItemParaReactivar({
                                                id: sabAgotado.id,
                                                nombre: `${prod.nombre} (${sab.nombre})`,
                                              })
                                            }
                                            style={{
                                              minHeight: '36px',
                                              padding: '0 10px',
                                              borderRadius: '6px',
                                              border: '1px solid var(--cp-navy)',
                                              background: 'transparent',
                                              fontSize: '12px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Reactivar
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setItemParaDuracion({
                                              tipo: 'SABOR',
                                              id: sab.id,
                                              nombre: `${prod.nombre} (${sab.nombre})`,
                                              subtitulo: `Sabor de ${prod.nombre}`,
                                            })
                                          }
                                          style={{
                                            minHeight: '36px',
                                            padding: '0 10px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--cp-rust)',
                                            background: 'transparent',
                                            color: 'var(--cp-rust)',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Agotar sabor
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Opciones */}
                            {prod.opciones && prod.opciones.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>
                                  OPCIONES
                                </div>
                                {prod.opciones.map((op) => {
                                  const opAgotado = mapaAgotados.get(`OPCION-${op.id}`);
                                  return (
                                    <div
                                      key={op.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: opAgotado ? 'rgb(254, 245, 243)' : 'var(--cp-sand, #F7F3EB)',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                      }}
                                    >
                                      <span style={{ fontWeight: 700 }}>
                                        {op.nombre} {op.grupoNombre ? `(${op.grupoNombre})` : ''}
                                      </span>
                                      {opAgotado ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 800 }}>
                                            Agotado
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setItemParaReactivar({
                                                id: opAgotado.id,
                                                nombre: `${prod.nombre} (${op.nombre})`,
                                              })
                                            }
                                            style={{
                                              minHeight: '36px',
                                              padding: '0 10px',
                                              borderRadius: '6px',
                                              border: '1px solid var(--cp-navy)',
                                              background: 'transparent',
                                              fontSize: '12px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Reactivar
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setItemParaDuracion({
                                              tipo: 'OPCION',
                                              id: op.id,
                                              nombre: `${prod.nombre} (${op.nombre})`,
                                              subtitulo: `Opción de ${prod.nombre}`,
                                            })
                                          }
                                          style={{
                                            minHeight: '36px',
                                            padding: '0 10px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--cp-rust)',
                                            background: 'transparent',
                                            color: 'var(--cp-rust)',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Agotar opción
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumen de agotados actuales si hay alguno */}
        {agotadosVigentes.length > 0 && (
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1.5px solid var(--cp-line)',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
              Agotados ahora ({agotadosVigentes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {agotadosVigentes.map((ag) => {
                const nom =
                  ag.nombre ||
                  ag.productoNombre ||
                  ag.saborNombre ||
                  ag.opcionNombre ||
                  'Elemento';
                return (
                  <div
                    key={ag.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      borderBottom: '1px solid var(--cp-line)',
                      paddingBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>
                      <b>{nom}</b> · {renderHoraRegreso(ag)} ·{' '}
                      <span title={textosOrigenAgotado(ag.origen).ayuda}>{textosOrigenAgotado(ag.origen).corto}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItemParaReactivar({
                          id: ag.id,
                          nombre: nom,
                        })
                      }
                      style={{
                        minHeight: '40px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        background: 'transparent',
                        color: 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      Reactivar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={alCerrar}
          style={{
            minHeight: '48px',
            borderRadius: '12px',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>

      {/* Diálogo de Confirmación para Agotar */}
      <Confirmar
        abierto={!!itemParaAgotar}
        titulo={`¿Confirmar agotar «${itemParaAgotar?.item.nombre}»?`}
        mensaje={
          itemParaAgotar?.duracion === 'HOY'
            ? 'Dejará de ofrecerse de inmediato en la carta y el chatbot. Volverá a estar disponible automáticamente mañana a medianoche.'
            : 'Dejará de ofrecerse de inmediato en la carta y el chatbot hasta que se reactive manualmente.'
        }
        textoConfirmar="Sí, marcar agotado"
        textoNo="No, cancelar"
        cargando={guardandoAgotado}
        alConfirmar={ejecutarAgotar}
        alCancelar={() => setItemParaAgotar(null)}
      />

      {/* Diálogo de Confirmación para Reactivar */}
      <Confirmar
        abierto={!!itemParaReactivar}
        titulo={`¿Volver a ofrecer «${itemParaReactivar?.nombre || ''}»?`}
        mensaje="Volverá a estar disponible de inmediato para todos los clientes en la carta y el chatbot."
        textoConfirmar="Sí, reactivar"
        textoNo="No, cancelar"
        cargando={guardandoReactivar}
        alConfirmar={ejecutarReactivar}
        alCancelar={() => setItemParaReactivar(null)}
      />
    </>
  );
}
