import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useEventos } from '../../comun/socket';
import { TarjetaReparto } from './TarjetaReparto';
import {
  repartosApi,
  PedidoReparto,
  ResumenRepartos,
  RespuestaMios,
} from './repartosApi';

type TabRepartos = 'disponibles' | 'mios' | 'todos';

// Cálculo de distancia aproximada en km entre dos coordenadas (Haversine simple)
function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function RepartosView() {
  const { tiene, usuario } = useSesion();
  const puedeVer = tiene('repartos/ver');
  const puedeLiquidar = tiene('repartos/liquidar');

  // Si el usuario es repartidor, la pestaña inicial es 'mios' o 'disponibles'
  const esRolRepartidor = usuario?.rol === 'REPARTIDOR';
  const [tabActiva, setTabActiva] = useState<TabRepartos>('disponibles');

  // Datos
  const [disponibles, setDisponibles] = useState<PedidoReparto[]>([]);
  const [datosMios, setDatosMios] = useState<RespuestaMios>({
    pedidos: [],
    orden: [],
    paso: [],
    ruta: [],
  });
  const [todos, setTodos] = useState<PedidoReparto[]>([]);
  const [resumen, setResumen] = useState<ResumenRepartos | null>(null);

  // Filtros
  const [filtroZona, setFiltroZona] = useState<string>('todas');
  const [filtroRepartidor, setFiltroRepartidor] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  // Estados de carga
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!puedeVer) return;
    setError(null);

    try {
      if (tabActiva === 'disponibles') {
        const [disp, res] = await Promise.all([
          repartosApi.listarDisponibles(),
          repartosApi.obtenerResumen().catch(() => null),
        ]);
        setDisponibles(disp);
        setResumen(res);
      } else if (tabActiva === 'mios') {
        const mios = await repartosApi.listarMios();
        setDatosMios(mios);
      } else if (tabActiva === 'todos') {
        const tod = await repartosApi.listarTodos({
          repartidor: filtroRepartidor || undefined,
          estado: filtroEstado || undefined,
        });
        setTodos(tod);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los repartos');
    } finally {
      setCargando(false);
    }
  }, [puedeVer, tabActiva, filtroRepartidor, filtroEstado]);

  useEffect(() => {
    setCargando(true);
    cargarDatos();
  }, [cargarDatos]);

  // Actualización en vivo vía Socket.IO
  useEventos('pedido:estado', () => {
    cargarDatos();
  });

  useEventos('reparto:incidente', () => {
    cargarDatos();
  });

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de repartos." />
      </div>
    );
  }

  // Filtrado de disponibles por zona
  const zonasDisponibles = Array.from(
    new Set(disponibles.map((p) => p.zona).filter(Boolean)),
  ) as string[];

  const pedidosDisponiblesFiltrados = disponibles.filter((p) => {
    if (filtroZona !== 'todas' && p.zona !== filtroZona) return false;
    return true;
  });

  // Ordenar mis pedidos según la ruta sugerida
  const pedidosMiosOrdenados = [...datosMios.pedidos].sort((a, b) => {
    const orden = datosMios.orden || [];
    const idxA = orden.indexOf(String(a.id));
    const idxB = orden.indexOf(String(b.id));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '12px 16px 40px 16px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Cabecera y Selector de Pestañas (Touch friendly, >= 44px) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '22px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Repartos
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
              Gestión táctil de pedidos a domicilio y entregas
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCargando(true);
              cargarDatos();
            }}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Actualizar
          </button>
        </div>

        {/* Tabs estilo pastilla */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          <button
            role="tab"
            aria-selected={tabActiva === 'disponibles'}
            onClick={() => setTabActiva('disponibles')}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: tabActiva === 'disponibles' ? 'var(--cp-navy)' : 'var(--cp-white)',
              color: tabActiva === 'disponibles' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Disponibles {disponibles.length > 0 && `(${disponibles.length})`}
          </button>

          <button
            role="tab"
            aria-selected={tabActiva === 'mios'}
            onClick={() => setTabActiva('mios')}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: tabActiva === 'mios' ? 'var(--cp-navy)' : 'var(--cp-white)',
              color: tabActiva === 'mios' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Mis pedidos {datosMios.pedidos.length > 0 && `(${datosMios.pedidos.length})`}
          </button>

          {(!esRolRepartidor || puedeLiquidar) && (
            <button
              role="tab"
              aria-selected={tabActiva === 'todos'}
              onClick={() => setTabActiva('todos')}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: tabActiva === 'todos' ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: tabActiva === 'todos' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Todos los repartidores
            </button>
          )}
        </div>
      </div>

      {/* Contenido según pestaña */}
      {cargando ? (
        <div style={{ padding: '40px 0' }}>
          <Cargando mensaje="Cargando pedidos de reparto..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      ) : tabActiva === 'disponibles' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Pastillas «Dónde hay más» */}
          {resumen && (
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
                Dónde hay más pedidos listos
              </span>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {resumen.lados &&
                  Object.entries(resumen.lados).map(([lado, cant]) => (
                    <span
                      key={lado}
                      style={{
                        minHeight: '32px',
                        boxSizing: 'border-box',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: Number(cant) > 0 ? 'var(--cp-navy)' : 'transparent',
                        color: Number(cant) > 0 ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      {lado}: {cant}
                    </span>
                  ))}

                {resumen.zonas && Object.keys(resumen.zonas).length > 0 && (
                  <>
                    <span style={{ width: '1px', height: '20px', background: 'var(--cp-line)' }} />
                    {Object.entries(resumen.zonas).map(([zona, cant]) => (
                      <span
                        key={zona}
                        style={{
                          minHeight: '32px',
                          boxSizing: 'border-box',
                          padding: '0 10px',
                          borderRadius: '9999px',
                          border: '1.5px dashed var(--cp-soft)',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--cp-navy)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {zona}: {cant}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Filtro rápido por zona */}
          {zonasDisponibles.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                Zona:
              </span>
              <button
                type="button"
                onClick={() => setFiltroZona('todas')}
                style={{
                  minHeight: '36px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--cp-line)',
                  background: filtroZona === 'todas' ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: filtroZona === 'todas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Todas
              </button>
              {zonasDisponibles.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setFiltroZona(z)}
                  style={{
                    minHeight: '36px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1px solid var(--cp-line)',
                    background: filtroZona === z ? 'var(--cp-navy)' : 'var(--cp-white)',
                    color: filtroZona === z ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {z}
                </button>
              ))}
            </div>
          )}

          {pedidosDisponiblesFiltrados.length === 0 ? (
            <EstadoVacio
              titulo="No hay pedidos disponibles"
              mensaje="No hay pedidos de delivery en cocina listos para repartir en este momento."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              {pedidosDisponiblesFiltrados.map((p) => (
                <TarjetaReparto
                  key={p.id}
                  pedido={p}
                  esDisponible
                  puedeLiquidar={puedeLiquidar}
                  alActualizar={cargarDatos}
                />
              ))}
            </div>
          )}
        </div>
      ) : tabActiva === 'mios' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Ruta sugerida y lista de paradas */}
          {pedidosMiosOrdenados.length > 0 && (
            <div
              style={{
                background: 'var(--cp-cream)',
                border: '1.5px solid var(--cp-orange)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '15px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Ruta sugerida de entrega
                </span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600 }}>
                  (sin mapa en esta ola)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pedidosMiosOrdenados.map((p, idx) => {
                  let distAprox = '';
                  if (idx > 0 && p.lat && p.lng) {
                    const prev = pedidosMiosOrdenados[idx - 1];
                    if (prev.lat && prev.lng) {
                      const d = calcularDistanciaKm(prev.lat, prev.lng, p.lat, p.lng);
                      distAprox = `${d} km de la parada anterior`;
                    }
                  } else if (p.lat && p.lng) {
                    distAprox = 'Primera parada desde el local';
                  }

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--cp-white)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        border: '1px solid var(--cp-line)',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '12px',
                            background: 'var(--cp-navy)',
                            color: 'var(--cp-cream)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '12px',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <b>{p.codigo}</b> · {p.cliente_nombre} ({p.direccion || 'Sin dirección'})
                        </div>
                      </div>
                      {distAprox && (
                        <span style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 600, flexShrink: 0 }}>
                          {distAprox}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pedidosMiosOrdenados.length === 0 ? (
            <EstadoVacio
              titulo="No tienes pedidos asignados"
              mensaje="Ve a la pestaña Disponibles para tomar pedidos listos para entrega."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              {pedidosMiosOrdenados.map((p, idx) => (
                <TarjetaReparto
                  key={p.id}
                  pedido={p}
                  esMio
                  paradaNumero={idx + 1}
                  puedeLiquidar={puedeLiquidar}
                  alActualizar={cargarDatos}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Pestaña: Todos los repartidores (Admin / Caja) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Filtros */}
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: '1 1 180px' }}>
              <label
                htmlFor="filtro-rep"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                ID de repartidor
              </label>
              <input
                id="filtro-rep"
                type="text"
                placeholder="Ej. ID del repartidor"
                value={filtroRepartidor}
                onChange={(e) => setFiltroRepartidor(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1px solid var(--cp-line)',
                  padding: '0 10px',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label
                htmlFor="filtro-est"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Estado
              </label>
              <select
                id="filtro-est"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1px solid var(--cp-line)',
                  padding: '0 10px',
                  fontSize: '13px',
                  background: 'var(--cp-white)',
                }}
              >
                <option value="">Todos los estados</option>
                <option value="LISTO">Listo</option>
                <option value="EN_CAMINO">En camino</option>
                <option value="ENTREGADO">Entregado</option>
              </select>
            </div>

            <button
              type="button"
              onClick={cargarDatos}
              style={{
                minHeight: '44px',
                padding: '0 18px',
                borderRadius: '8px',
                background: 'var(--cp-navy)',
                color: 'var(--cp-cream)',
                border: 0,
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Filtrar
            </button>
          </div>

          {todos.length === 0 ? (
            <EstadoVacio
              titulo="No se encontraron repartos"
              mensaje="No hay pedidos con los filtros seleccionados."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              {todos.map((p) => (
                <TarjetaReparto
                  key={p.id}
                  pedido={p}
                  puedeLiquidar={puedeLiquidar}
                  alActualizar={cargarDatos}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
