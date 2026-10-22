import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useEventos } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { MapaPedidos, PuntoPedido } from '../../comun/mapa/MapaPedidos';
import { TarjetaReparto } from './TarjetaReparto';
import { ResumenPedidoReparto } from './ResumenPedidoReparto';
import { useAccionesReparto } from './useAccionesReparto';
import {
  repartosApi,
  PedidoReparto,
  ResumenRepartos,
  RespuestaMios,
} from './repartosApi';

type ModoVista = 'mapa' | 'lista';
type TipoTile = 'todos' | 'disp' | 'ruta' | 'prob' | 'done';

function agruparPorZona(
  pedidos: PedidoReparto[],
): { zona: string; pedidos: PedidoReparto[] }[] {
  const mapa = new Map<string, PedidoReparto[]>();
  for (const p of pedidos) {
    const z = p.zona || 'Sin zona';
    if (!mapa.has(z)) mapa.set(z, []);
    mapa.get(z)!.push(p);
  }
  return Array.from(mapa.entries()).map(([zona, items]) => ({
    zona,
    pedidos: items,
  }));
}

export function RepartosView() {
  const { tiene, usuario } = useSesion();
  const puedeVer = tiene('repartos/ver');
  const puedeLiquidar = tiene('repartos/liquidar');
  const esRolRepartidor = usuario?.rol === 'REPARTIDOR';

  // Modo de vista: 'mapa' por defecto (acta 03, DT-59, RQ-DEL-02-01)
  const [modoVista, setModoVista] = useState<ModoVista>('mapa');

  // Filtro de rol / repartidor: arranca en 'all' ("Todos (caja)") como en el mockup
  const [filtroRider, setFiltroRider] = useState<string>('all');

  // Tarjeta activa: arranca en 'todos' en azul marino como en el mockup
  const [filtroTile, setFiltroTile] = useState<TipoTile>('todos');

  // Filtro de zona: arranca en 'todas'
  const [filtroZona, setFiltroZona] = useState<string>('todas');

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

  // Selección de pedido en el mapa
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Estados de carga
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!puedeVer) return;
    setError(null);

    try {
      const [disp, res, mios, tod] = await Promise.all([
        repartosApi.listarDisponibles().catch(() => []),
        repartosApi.obtenerResumen().catch(() => null),
        repartosApi.listarMios().catch(() => ({ pedidos: [], orden: [], paso: [], ruta: [] })),
        repartosApi.listarTodos().catch(() => []),
      ]);
      setDisponibles(disp);
      setResumen(res);
      setDatosMios(mios);
      setTodos(tod);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los repartos');
    } finally {
      setCargando(false);
    }
  }, [puedeVer]);

  const acciones = useAccionesReparto({ alActualizar: cargarDatos });

  useEffect(() => {
    setCargando(true);
    setPedidoSeleccionadoId(null);
    cargarDatos();
  }, [cargarDatos]);

  // Actualización en vivo vía Socket.IO
  useEventos('pedido:estado', () => {
    cargarDatos();
  });

  useEventos('reparto:incidente', () => {
    cargarDatos();
  });

  // Lista consolidada de pedidos según rol y selección "Ver como:"
  const pedidosBase = useMemo(() => {
    const todosLista = todos.length > 0 ? todos : [...disponibles, ...datosMios.pedidos];

    if (esRolRepartidor && !puedeLiquidar) {
      return todosLista.filter(
        (o) =>
          (o.estado === 'LISTO' && !o.repartidor_party_id) ||
          o.repartidor_party_id === usuario?.partyId ||
          datosMios.pedidos.some((m) => m.id === o.id),
      );
    }

    if (filtroRider === 'all') {
      return todosLista;
    }

    return todosLista.filter((o) => {
      const rId = o.repartidor?.id || o.repartidor_party_id;
      return (
        rId === filtroRider ||
        o.repartidor?.nombre?.toLowerCase().includes(filtroRider) ||
        (filtroTile === 'disp' && !rId)
      );
    });
  }, [todos, disponibles, datosMios, esRolRepartidor, puedeLiquidar, filtroRider, filtroTile, usuario]);

  // Conteos reactivos para los 5 azulejos métricos (rpTiles)
  const conteoTiles = useMemo(() => {
    const totalCount = pedidosBase.length;
    const dispCount = pedidosBase.filter(
      (p) => p.estado === 'LISTO' && !p.repartidor_party_id && !p.repartidor,
    ).length;
    const rutaCount = pedidosBase.filter((p) => p.estado === 'EN_CAMINO').length;
    const probCount = pedidosBase.filter((p) => !!p.motivo_falla).length;
    const entregadosCount = pedidosBase.filter((p) => p.estado === 'ENTREGADO').length;

    return {
      todos: totalCount,
      disp: dispCount,
      ruta: rutaCount,
      prob: probCount,
      done: entregadosCount,
    };
  }, [pedidosBase]);

  const rpTiles = [
    {
      id: 'todos' as TipoTile,
      n: 'Todos',
      v: conteoTiles.todos,
      on: filtroTile === 'todos',
      bg: filtroTile === 'todos' ? 'var(--cp-navy)' : 'var(--cp-white)',
      fg: filtroTile === 'todos' ? 'var(--cp-cream)' : 'var(--cp-navy)',
      bd: filtroTile === 'todos' ? 'var(--cp-navy)' : 'var(--cp-line)',
      ariaLabel: 'Todos',
    },
    {
      id: 'disp' as TipoTile,
      n: 'Disponibles',
      v: conteoTiles.disp,
      on: filtroTile === 'disp',
      bg: filtroTile === 'disp' ? 'var(--cp-orange)' : 'var(--cp-white)',
      fg: 'var(--cp-navy)',
      bd: filtroTile === 'disp' ? 'var(--cp-orange)' : 'var(--cp-line)',
      ariaLabel: 'Disponibles',
    },
    {
      id: 'ruta' as TipoTile,
      n: 'En ruta',
      v: conteoTiles.ruta,
      on: filtroTile === 'ruta',
      bg: filtroTile === 'ruta' ? 'var(--cp-navy)' : 'var(--cp-white)',
      fg: filtroTile === 'ruta' ? 'var(--cp-cream)' : 'var(--cp-navy)',
      bd: filtroTile === 'ruta' ? 'var(--cp-navy)' : 'var(--cp-line)',
      ariaLabel: 'En ruta · Mis pedidos',
    },
    {
      id: 'prob' as TipoTile,
      n: 'Con problema',
      v: conteoTiles.prob,
      on: filtroTile === 'prob',
      bg: filtroTile === 'prob' ? 'var(--cp-rust)' : 'var(--cp-white)',
      fg: filtroTile === 'prob' ? 'var(--cp-cream)' : 'var(--cp-navy)',
      bd: filtroTile === 'prob' ? 'var(--cp-rust)' : 'var(--cp-line)',
      ariaLabel: 'Con problema',
    },
    {
      id: 'done' as TipoTile,
      n: 'Entregados',
      v: conteoTiles.done,
      on: filtroTile === 'done',
      bg: filtroTile === 'done' ? 'var(--cp-ok, #2E8B57)' : 'var(--cp-white)',
      fg: filtroTile === 'done' ? 'var(--cp-cream)' : 'var(--cp-navy)',
      bd: filtroTile === 'done' ? 'var(--cp-ok, #2E8B57)' : 'var(--cp-line)',
      ariaLabel: 'Entregados',
    },
  ];

  // Pedidos filtrados según azulejo activo y zona
  const pedidosFiltrados = useMemo(() => {
    let lista = pedidosBase;

    if (filtroTile === 'disp') {
      lista = lista.filter(
        (p) => p.estado === 'LISTO' && !p.repartidor_party_id && !p.repartidor,
      );
    } else if (filtroTile === 'ruta') {
      lista = lista.filter((p) => p.estado === 'EN_CAMINO');
    } else if (filtroTile === 'prob') {
      lista = lista.filter((p) => !!p.motivo_falla);
    } else if (filtroTile === 'done') {
      lista = lista.filter((p) => p.estado === 'ENTREGADO');
    }

    if (filtroZona !== 'todas') {
      lista = lista.filter((p) => p.zona === filtroZona);
    }

    return lista;
  }, [pedidosBase, filtroTile, filtroZona]);

  // Conteos por zona para las pastillas punteadas de «Dónde hay más»
  const zonasContadas = useMemo(() => {
    if (resumen?.zonas && Object.keys(resumen.zonas).length > 0) {
      return resumen.zonas;
    }
    const mapa: Record<string, number> = {};
    for (const p of pedidosBase) {
      if (p.zona) {
        mapa[p.zona] = (mapa[p.zona] || 0) + 1;
      }
    }
    return mapa;
  }, [resumen, pedidosBase]);

  // Lados cardinales (Norte, Sur, Este, Oeste)
  const ladosContados = useMemo(() => {
    if (resumen?.lados && Object.keys(resumen.lados).length > 0) {
      return resumen.lados;
    }
    return { Norte: 0, Sur: 0, Este: 0, Oeste: 0 };
  }, [resumen]);

  const maxLado = useMemo(() => {
    return Math.max(1, ...Object.values(ladosContados));
  }, [ladosContados]);

  // Pedidos para el mapa Leaflet
  const puntosMapa: PuntoPedido[] = useMemo(() => {
    const ordenMios = datosMios.orden || [];
    return pedidosFiltrados
      .filter((p) => {
        if (p.lat == null || p.lng == null) return false;
        if (filtroTile === 'todos') {
          return p.estado === 'LISTO' || p.estado === 'EN_CAMINO';
        }
        return true;
      })
      .map((p) => {
        const idx = ordenMios.indexOf(String(p.id));
        const ordenNumero = idx !== -1 ? idx + 1 : undefined;
        return {
          id: p.id,
          lat: p.lat!,
          lng: p.lng!,
          etiqueta: p.cliente_nombre,
          detalle: `${p.codigo}${p.estado === 'EN_CAMINO' ? ' · en camino' : ''}${
            p.repartidor?.nombre ? ` · ${p.repartidor.nombre}` : ''
          }`,
          color: p.color,
          orden: ordenNumero,
        };
      });
  }, [pedidosFiltrados, filtroTile, datosMios.orden]);

  // Pedidos sin ubicar (lat/lng nulos)
  const pedidosFaltaUbicar = useMemo(() => {
    return pedidosFiltrados.filter((p) => p.lat == null || p.lng == null);
  }, [pedidosFiltrados]);

  // Pedidos de "mis pedidos" ordenados según la ruta de la API
  const pedidosMiosOrdenados = useMemo(() => {
    const orden = datosMios.orden || [];
    return [...datosMios.pedidos].sort((a, b) => {
      const idxA = orden.indexOf(String(a.id));
      const idxB = orden.indexOf(String(b.id));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }, [datosMios]);

  // Cartel flotante sobre el mapa idéntico al mockup (rmNote)
  const rmNote = useMemo(() => {
    if (!esRolRepartidor && filtroRider === 'all') {
      return 'Vista de caja: todos los pedidos listos y en camino.';
    }
    if (datosMios.pedidos.length > 0) {
      const nombres = pedidosMiosOrdenados
        .map((p, i) => `${i + 1} ${p.cliente_nombre.split(' ')[0]}`)
        .join(' → ');
      return `La línea naranja es la ruta sugerida: pesa la cercanía y, más, el que lleva más esperando (solo sugerencia). Orden: ${nombres}`;
    }
    return 'Toca un punto para ver el pedido y tomarlo. Los anillos son kilómetros desde el local.';
  }, [esRolRepartidor, filtroRider, datosMios.pedidos.length, pedidosMiosOrdenados]);

  // Pedido seleccionado al tocar un punto
  const pedidoSeleccionado = useMemo(() => {
    if (!pedidoSeleccionadoId) return null;
    return pedidosBase.find((p) => p.id === pedidoSeleccionadoId) || null;
  }, [pedidoSeleccionadoId, pedidosBase]);

  // Agrupación por zona para la vista Lista
  const gruposPorZona = useMemo(() => {
    return agruparPorZona(pedidosFiltrados);
  }, [pedidosFiltrados]);

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de repartos." />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 1) Fila «Ver como:» / «Soy:» */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>
          {esRolRepartidor ? 'Soy:' : 'Ver como:'}
        </span>
        {(!esRolRepartidor || puedeLiquidar) && (
          <button
            type="button"
            onClick={() => {
              setFiltroRider('all');
              setPedidoSeleccionadoId(null);
            }}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: filtroRider === 'all' ? 'var(--cp-navy)' : 'transparent',
              color: filtroRider === 'all' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Todos (caja)
          </button>
        )}
        {[
          { id: 'r1', n: 'Repartidor 1' },
          { id: 'r2', n: 'Repartidor 2' },
          { id: 'r3', n: 'Repartidor 3' },
        ].map((r) => {
          const activo = filtroRider === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setFiltroRider(r.id);
                setPedidoSeleccionadoId(null);
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: activo ? 'var(--cp-navy)' : 'transparent',
                color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {r.n}
            </button>
          );
        })}
      </div>

      {/* 2) 5 Tarjetas métricas (rpTiles) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        {rpTiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            role="tab"
            aria-label={tile.ariaLabel}
            aria-selected={tile.on}
            aria-pressed={tile.on}
            onClick={() => {
              setFiltroTile(tile.id);
              setPedidoSeleccionadoId(null);
            }}
            style={{
              textAlign: 'left',
              minHeight: '64px',
              border: `1.5px solid ${tile.bd}`,
              borderRadius: '14px',
              background: tile.bg,
              color: tile.fg,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, opacity: 0.85 }}>
              {tile.n}
            </span>
            <span
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '24px',
                lineHeight: '30px',
              }}
            >
              {tile.v}
            </span>
          </button>
        ))}
      </div>

      {/* 3) Sección colapsable "¿Cómo funciona?" */}
      <details style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        <summary
          style={{
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          ¿Cómo funciona?
        </summary>
        <div style={{ lineHeight: '19px', paddingBottom: '6px' }}>
          Cada pedido listo aparece como Disponible. El repartidor que lo toma se lo queda y a los demás les desaparece. Desde su celular abre la dirección en Waze o Google Maps. Caja y call center ven quién tomó cada pedido. Si algo falla, el repartidor lo reporta y caja y call center coordinan con el cliente por WhatsApp.
        </div>
      </details>

      {/* 4) Alternancia [Mapa] [Lista] con leyenda exacta */}
      <div
        role="group"
        aria-label="Vista de repartos"
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          aria-pressed={modoVista === 'mapa'}
          onClick={() => setModoVista('mapa')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modoVista === 'mapa' ? 'var(--cp-navy)' : 'transparent',
            color: modoVista === 'mapa' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Mapa
        </button>
        <button
          type="button"
          aria-pressed={modoVista === 'lista'}
          onClick={() => setModoVista('lista')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: modoVista === 'lista' ? 'var(--cp-navy)' : 'transparent',
            color: modoVista === 'lista' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Lista
        </button>
        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
          Verde: menos de 35 min · Naranja: retraso · Rojo: más de 50 min (crítico)
        </span>
      </div>

      {cargando ? (
        <div style={{ padding: '40px 0' }}>
          <Cargando mensaje="Cargando pedidos de reparto..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      ) : modoVista === 'mapa' ? (
        /* VISTA MAPA (Principal) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Fila compacta «Dónde hay más:» con cardinales y pastillas de zona punteadas que filtran */}
          <div
            aria-label="Pedidos por lado y por zona"
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              alignItems: 'center',
              flex: 'none',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--cp-soft)',
              }}
            >
              Dónde hay más:
            </span>
            {Object.entries(ladosContados).map(([lado, cant]) => (
              <span
                key={lado}
                style={{
                  minHeight: '32px',
                  boxSizing: 'border-box',
                  padding: '0 10px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background:
                    Number(cant) > 0
                      ? `color-mix(in srgb, var(--cp-orange) ${Math.round(20 + (60 * Number(cant)) / maxLado)}%, var(--cp-white))`
                      : 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '12px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {cant} {lado}
              </span>
            ))}
            {Object.keys(zonasContadas).length > 0 && (
              <>
                <span
                  style={{
                    width: '1px',
                    height: '20px',
                    background: 'var(--cp-line)',
                  }}
                />
                {Object.entries(zonasContadas)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([zona, cant]) => {
                    const activa = filtroZona === zona;
                    return (
                      <button
                        key={zona}
                        type="button"
                        aria-label={zona}
                        onClick={() => setFiltroZona(activa ? 'todas' : zona)}
                        style={{
                          minHeight: '32px',
                          boxSizing: 'border-box',
                          padding: '0 10px',
                          borderRadius: '9999px',
                          border: activa
                            ? '1.5px solid var(--cp-navy)'
                            : '1.5px dashed var(--cp-soft)',
                          background: activa ? 'var(--cp-navy)' : 'transparent',
                          color: activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <span aria-hidden="true">{zona}: {cant}</span>
                      </button>
                    );
                  })}
              </>
            )}
          </div>

          {/* Aviso de pedidos sin ubicar en el mapa */}
          {pedidosFaltaUbicar.length > 0 && (
            <div
              role="status"
              style={{
                background: '#FFF6E3',
                border: '1.5px solid var(--cp-gold, #D4A373)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>
                Hay {pedidosFaltaUbicar.length} pedido(s) sin ubicación en esta vista (no aparecen en el mapa).
              </span>
              <button
                type="button"
                onClick={() => setModoVista('lista')}
                style={{
                  minHeight: '36px',
                  padding: '0 12px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Ver en Lista
              </button>
            </div>
          )}

          {/* Caja del mapa idéntica a la del mockup */}
          <div
            style={{
              position: 'relative',
              flex: 'none',
              background: '#E8EFE6',
              border: '1px solid var(--cp-line)',
              borderRadius: '16px',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            {/* Cartel flotante con fondo traslúcido */}
            <div
              style={{
                position: 'absolute',
                left: '10px',
                top: '10px',
                background: 'rgba(255, 255, 255, 0.92)',
                borderRadius: '10px',
                padding: '6px 10px',
                fontSize: '12px',
                lineHeight: '16px',
                fontWeight: 700,
                maxWidth: '60%',
                zIndex: 1000,
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(11, 44, 62, 0.1)',
              }}
            >
              {rmNote}
            </div>

            <MapaPedidos
              puntos={puntosMapa}
              seleccionado={pedidoSeleccionadoId}
              onSeleccionar={(id) =>
                setPedidoSeleccionadoId((prev) => (prev === id ? null : id))
              }
              altura="min(62vh, 560px)"
            />
          </div>

          {/* Resumen del pedido seleccionado al tocar un punto (RQ-DEL-02-15) */}
          {pedidoSeleccionado && (
            <ResumenPedidoReparto
              pedido={pedidoSeleccionado}
              esMio={
                pedidoSeleccionado.repartidor_party_id === usuario?.partyId ||
                pedidoSeleccionado.estado === 'EN_CAMINO'
              }
              esDisponible={
                pedidoSeleccionado.estado === 'LISTO' &&
                !pedidoSeleccionado.repartidor_party_id
              }
              puedeLiquidar={puedeLiquidar}
              alCerrar={() => setPedidoSeleccionadoId(null)}
              acciones={acciones}
            />
          )}

          {/* Ruta sugerida de entrega y paradas cuando se examina la ruta de un repartidor */}
          {(filtroTile === 'ruta' || esRolRepartidor) && datosMios.pedidos.length > 0 && (
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '16px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Ruta sugerida de entrega ({pedidosMiosOrdenados.length} paradas)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pedidosMiosOrdenados.map((p, idx) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--cp-cream)',
                      borderRadius: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '12px',
                          background: 'var(--cp-orange)',
                          color: 'var(--cp-navy)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '12px',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 800 }}>{p.codigo}</span>
                      <span>·</span>
                      <span>{p.cliente_nombre}</span>
                    </div>
                    <span style={{ color: 'var(--cp-soft)', fontWeight: 600 }}>
                      {p.zona || 'Sin zona'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VISTA LISTA */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Fila de pastillas por zona en vista Lista (rzChips del mockup) */}
          <div
            role="group"
            aria-label="Zona"
            style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => setFiltroZona('todas')}
              style={{
                minHeight: '40px',
                padding: '0 12px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: filtroZona === 'todas' ? 'var(--cp-navy)' : 'transparent',
                color: filtroZona === 'todas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Todas las zonas
            </button>
            {Object.entries(zonasContadas).map(([z, cant]) => {
              const activo = filtroZona === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => setFiltroZona(activo ? 'todas' : z)}
                  style={{
                    minHeight: '40px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    background: activo ? 'var(--cp-navy)' : 'transparent',
                    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {z} · {cant}
                </button>
              );
            })}
          </div>

          {gruposPorZona.length === 0 ? (
            <EstadoVacio
              mensaje={
                pedidosFiltrados.length === 0
                  ? 'No hay pedidos en esta vista.'
                  : 'No hay pedidos para la zona seleccionada.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {gruposPorZona.map((grupo) => (
                <div
                  key={grupo.zona}
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--cp-navy)',
                      paddingLeft: '4px',
                    }}
                  >
                    {grupo.zona} · {grupo.pedidos.length}{' '}
                    {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '14px',
                      alignItems: 'start',
                    }}
                  >
                    {grupo.pedidos.map((pedido) => (
                      <TarjetaReparto
                        key={pedido.id}
                        pedido={pedido}
                        esDisponible={
                          pedido.estado === 'LISTO' && !pedido.repartidor_party_id
                        }
                        esMiPedido={
                          pedido.repartidor_party_id === usuario?.partyId ||
                          pedido.estado === 'EN_CAMINO'
                        }
                        alActualizar={cargarDatos}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación global para acciones de reparto */}
      <Confirmar
        abierto={acciones.confirmarAccion.abierto}
        titulo={acciones.confirmarAccion.titulo}
        mensaje={acciones.confirmarAccion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={acciones.cargandoAccion}
        alConfirmar={acciones.confirmarAccion.ejecutar}
        alCancelar={acciones.cerrarConfirmacion}
      />
    </div>
  );
}
