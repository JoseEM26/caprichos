import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { ModalReportarFalla } from './ModalReportarFalla';
import {
  repartosApi,
  PedidoReparto,
  RespuestaMios,
  PedidoPerdido,
} from './repartosApi';
import {
  clasificarEspera,
  sugerirOrdenRuta,
  calcularMetricasRuta,
  ConfigReparto,
  CONFIG_REPARTO_DEFECTO,
  COORDENADAS_TIENDA_DEFECTO,
  PedidoParaRuta,
} from './calculoRuta';

type PestanaRepartidor = 'mi_ruta' | 'para_elegir' | 'hechos_hoy';

interface ConfirmarAccionModal {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  accion: () => Promise<void>;
  peligro?: boolean;
}

export function RepartidorView() {
  const { usuario } = useSesion();
  const [pestana, setPestana] = useState<PestanaRepartidor>('mi_ruta');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datosMios, setDatosMios] = useState<RespuestaMios>({
    pedidos: [],
    orden: [],
    paso: [],
    ruta: [],
  });
  const [disponibles, setDisponibles] = useState<PedidoReparto[]>([]);
  const [hechosHoy, setHechosHoy] = useState<PedidoReparto[]>([]);
  const [config, setConfig] = useState<ConfigReparto>(CONFIG_REPARTO_DEFECTO);

  // Selección en la pestaña "Para elegir"
  const [seleccionadosIds, setSeleccionadosIds] = useState<Set<string>>(new Set());
  const [pedidosPerdidosAviso, setPedidosPerdidosAviso] = useState<PedidoPerdido[]>([]);

  // Modal Confirmar (Sí/No)
  const [confirmacion, setConfirmacion] = useState<ConfirmarAccionModal>({
    abierto: false,
    titulo: '',
    mensaje: '',
    accion: async () => {},
  });
  const [ejecutandoAccion, setEjecutandoAccion] = useState(false);

  // Modal Reportar Falla
  const [pedidoParaFalla, setPedidoParaFalla] = useState<PedidoReparto | null>(null);

  const maxPedidos = config.maxPedidosPorRepartidor || 5;

  // Carga de datos centralizada
  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      const [miosRes, dispRes, entregadosRes, cfgRes] = await Promise.all([
        repartosApi.listarMios().catch(() => ({ pedidos: [], orden: [], paso: [], ruta: [] })),
        repartosApi.listarDisponibles().catch(() => []),
        repartosApi.listarTodos({ estado: 'ENTREGADO', historial: 'true' }).catch(() => []),
        repartosApi.obtenerConfig().catch(() => CONFIG_REPARTO_DEFECTO),
      ]);

      setDatosMios(miosRes);
      setDisponibles(dispRes);
      setHechosHoy(entregadosRes);
      if (cfgRes) setConfig(cfgRes);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los pedidos de reparto');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCargando(true);
    cargarDatos();
  }, [cargarDatos]);

  // Pedidos activos del repartidor en orden de ruta sugerida
  const pedidosActivos = useMemo(() => {
    const ordenMap = new Map((datosMios.orden || []).map((id, idx) => [String(id), idx]));
    return [...datosMios.pedidos].sort((a, b) => {
      const idxA = ordenMap.has(String(a.id)) ? ordenMap.get(String(a.id))! : 999;
      const idxB = ordenMap.has(String(b.id)) ? ordenMap.get(String(b.id))! : 999;
      return idxA - idxB;
    });
  }, [datosMios]);

  // Ruta sugerida de pedidos disponibles (hasta el tope configurable, default 5)
  const rutaSugeridaDisponibles = useMemo(() => {
    const candidatos: PedidoParaRuta[] = disponibles
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente_nombre: p.cliente_nombre || '',
        lat: p.lat!,
        lng: p.lng!,
        minutosEspera: p.minutosEspera || 0,
        zona: p.zona || undefined,
        total: p.total,
        pago_estado: p.pago_estado,
        pago_metodo: p.pago_metodo,
      }));

    const ordenados = sugerirOrdenRuta(
      candidatos,
      COORDENADAS_TIENDA_DEFECTO,
      config,
      maxPedidos,
    );

    const ordenIds = new Set(ordenados.map((o) => o.id));
    const enSugerida = disponibles.filter((p) => ordenIds.has(p.id));
    const fueraSugerida = disponibles.filter((p) => !ordenIds.has(p.id));
    return [...enSugerida, ...fueraSugerida].slice(0, maxPedidos);
  }, [disponibles, config, maxPedidos]);

  // Recálculo del orden óptimo de SOLO los pedidos elegidos
  const { pedidosElegidosOrdenados, metricasElegidos } = useMemo(() => {
    const elegidos = disponibles.filter((p) => seleccionadosIds.has(p.id));
    if (elegidos.length === 0) {
      return {
        pedidosElegidosOrdenados: [],
        metricasElegidos: null,
      };
    }

    const candidatos: PedidoParaRuta[] = elegidos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      cliente_nombre: p.cliente_nombre || '',
      lat: p.lat ?? COORDENADAS_TIENDA_DEFECTO.lat,
      lng: p.lng ?? COORDENADAS_TIENDA_DEFECTO.lng,
      minutosEspera: p.minutosEspera || 0,
      zona: p.zona || undefined,
      total: p.total,
      pago_estado: p.pago_estado,
      pago_metodo: p.pago_metodo,
    }));

    const ordenados = sugerirOrdenRuta(
      candidatos,
      COORDENADAS_TIENDA_DEFECTO,
      config,
      elegidos.length,
    );

    const metricas = calcularMetricasRuta(
      ordenados,
      COORDENADAS_TIENDA_DEFECTO,
      config.velocidadMediaKmH,
    );

    const filasMap = new Map(elegidos.map((p) => [String(p.id), p]));
    const enOrden = ordenados.map((o) => filasMap.get(String(o.id))!).filter(Boolean);

    return {
      pedidosElegidosOrdenados: enOrden,
      metricasElegidos: metricas,
    };
  }, [disponibles, seleccionadosIds, config]);

  // Total cobrado en efectivo hoy para liquidar
  const totalEfectivoHoy = useMemo(() => {
    return hechosHoy.reduce((acc, p) => {
      if (p.pago_metodo === 'EFECTIVO' || p.pago_metodo === 'efectivo') {
        return acc + Number(p.total || 0);
      }
      return acc;
    }, 0);
  }, [hechosHoy]);

  // Acciones con modal Confirmar
  const pedirConfirmacion = (
    titulo: string,
    mensaje: string,
    accion: () => Promise<void>,
    peligro = false,
  ) => {
    setConfirmacion({
      abierto: true,
      titulo,
      mensaje,
      accion,
      peligro,
    });
  };

  const ejecutarAccionConfirmada = async () => {
    setEjecutandoAccion(true);
    try {
      await confirmacion.accion();
      setConfirmacion((prev) => ({ ...prev, abierto: false }));
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || 'Error al ejecutar la acción');
    } finally {
      setEjecutandoAccion(false);
    }
  };

  // Alternar selección de un pedido para elegir
  const toggleSeleccion = (id: string) => {
    setSeleccionadosIds((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        const cupoDisponible = maxPedidos - pedidosActivos.length;
        if (nuevo.size >= cupoDisponible) {
          setError(`No puedes elegir más de ${cupoDisponible} pedidos (tope máximo: ${maxPedidos})`);
          return prev;
        }
        nuevo.add(id);
      }
      return nuevo;
    });
    setError(null);
  };

  // Tomar pedidos elegidos atómicamente
  const handleTomarElegidos = () => {
    const ids = Array.from(seleccionadosIds);
    if (ids.length === 0) return;

    const cupoDisponible = maxPedidos - pedidosActivos.length;
    if (ids.length > cupoDisponible) {
      setError(`Solo tienes cupo para ${cupoDisponible} pedidos más`);
      return;
    }

    pedirConfirmacion(
      '¿Iniciar ruta con los pedidos elegidos?',
      `Vas a tomar ${ids.length} pedido(s) y salir en ruta. Se calculará el orden óptimo de paradas.`,
      async () => {
        const res = await repartosApi.iniciarRuta({
          pedidoIds: pedidosElegidosOrdenados.map((p) => p.id),
        });

        if (res.perdidos && res.perdidos.length > 0) {
          setPedidosPerdidosAviso(res.perdidos);
        } else {
          setPedidosPerdidosAviso([]);
        }

        setSeleccionadosIds(new Set());
        setPestana('mi_ruta');
      },
    );
  };

  // Acciones individuales de pedidos en ruta
  const handleSalir = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Salir a reparto?',
      `El pedido ${pedido.codigo} cambiará a estado "En camino" y se registrará la hora de salida.`,
      async () => {
        await repartosApi.salir(pedido.id);
      },
    );
  };

  const handleLlegue = (pedido: PedidoReparto) => {
    pedirConfirmacion(
      '¿Marcar llegada?',
      `Confirmar que has llegado a la dirección del pedido ${pedido.codigo}.`,
      async () => {
        await repartosApi.llegue(pedido.id);
      },
    );
  };

  const handleEntregar = (pedido: PedidoReparto) => {
    const mensajeCobro =
      pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO'
        ? `Recuerda cobrar S/ ${Number(pedido.total).toFixed(2)} en efectivo.`
        : 'Pedido ya pagado previamente.';

    pedirConfirmacion(
      '¿Confirmar entrega?',
      `El pedido ${pedido.codigo} quedará registrado como ENTREGADO. ${mensajeCobro}`,
      async () => {
        await repartosApi.entregar(pedido.id);
      },
    );
  };

  const nombreUsuario = usuario?.nombres || 'Repartidor';

  return (
    <div
      data-testid="vista-repartidor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        background: '#FFFDF9',
        fontFamily: 'Montserrat, sans-serif',
        color: '#0B2C3E',
      }}
    >
      {/* Cabecera mobile-first */}
      <header
        data-testid="cabecera-repartidor"
        style={{
          background: '#0B2C3E',
          color: '#FFFFFF',
          padding: '16px 20px',
          borderBottom: '3px solid #E67929',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#D99E39',
                textTransform: 'uppercase',
              }}
            >
              Panel Repartidor
            </span>
            <h1
              style={{
                margin: '2px 0 0 0',
                fontSize: '18px',
                fontWeight: 800,
                color: '#FFFFFF',
              }}
            >
              {nombreUsuario}
            </h1>
          </div>

          <div
            data-testid="badge-tope-pedidos"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 800,
            }}
          >
            <span style={{ color: '#FBF4EC' }}>Llevas:</span>
            <span
              style={{
                color: pedidosActivos.length >= maxPedidos ? '#E67929' : '#FFFFFF',
                fontWeight: 900,
              }}
            >
              {pedidosActivos.length} / {maxPedidos} pedidos
            </span>
          </div>
        </div>
      </header>

      {/* Barra de pestañas mobile-first (botones grandes >= 48px) */}
      <nav
        role="tablist"
        aria-label="Pestañas de reparto"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          background: '#FBF4EC',
          borderBottom: '1.5px solid #E3D6C6',
          padding: '6px 8px',
          gap: '6px',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'mi_ruta'}
          data-testid="tab-mi-ruta"
          onClick={() => {
            setPestana('mi_ruta');
            setError(null);
          }}
          style={{
            minHeight: '48px',
            border: pestana === 'mi_ruta' ? '2px solid #0B2C3E' : '1px solid transparent',
            borderRadius: '12px',
            background: pestana === 'mi_ruta' ? '#FFFFFF' : 'transparent',
            color: '#0B2C3E',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Mi ruta</span>
          {pedidosActivos.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                background: '#E67929',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '1px 6px',
              }}
            >
              {pedidosActivos.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'para_elegir'}
          data-testid="tab-para-elegir"
          onClick={() => {
            setPestana('para_elegir');
            setError(null);
          }}
          style={{
            minHeight: '48px',
            border: pestana === 'para_elegir' ? '2px solid #0B2C3E' : '1px solid transparent',
            borderRadius: '12px',
            background: pestana === 'para_elegir' ? '#FFFFFF' : 'transparent',
            color: '#0B2C3E',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Para elegir</span>
          {disponibles.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                background: '#D99E39',
                color: '#0B2C3E',
                borderRadius: '8px',
                padding: '1px 6px',
              }}
            >
              {disponibles.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'hechos_hoy'}
          data-testid="tab-hechos-hoy"
          onClick={() => {
            setPestana('hechos_hoy');
            setError(null);
          }}
          style={{
            minHeight: '48px',
            border: pestana === 'hechos_hoy' ? '2px solid #0B2C3E' : '1px solid transparent',
            borderRadius: '12px',
            background: pestana === 'hechos_hoy' ? '#FFFFFF' : 'transparent',
            color: '#0B2C3E',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Hechos hoy</span>
          {hechosHoy.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                background: '#2F7A45',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '1px 6px',
              }}
            >
              {hechosHoy.length}
            </span>
          )}
        </button>
      </nav>

      {/* Avisos de conflicto / pedidos perdidos por concurrencia */}
      {pedidosPerdidosAviso.length > 0 && (
        <div
          role="alert"
          data-testid="alerta-pedidos-perdidos"
          style={{
            margin: '12px 16px 0 16px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#FDE8E8',
            border: '1.5px solid #B2500F',
            color: '#B2500F',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: '4px' }}>
            Aviso de asignación concurrente:
          </div>
          {pedidosPerdidosAviso.map((p, idx) => (
            <div key={idx} style={{ marginTop: '2px' }}>
              • El pedido <strong>{p.codigo}</strong>{' '}
              {p.motivo === 'OTRO_REPARTIDOR'
                ? `fue tomado por ${p.tomadoPor || 'otro repartidor'} un instante antes.`
                : p.motivo === 'LIMITE'
                ? 'supera el límite de pedidos activos simultáneos.'
                : 'ya no está disponible.'}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPedidosPerdidosAviso([])}
            style={{
              marginTop: '8px',
              minHeight: '48px',
              width: '100%',
              background: '#FFFFFF',
              border: '1px solid #B2500F',
              borderRadius: '8px',
              color: '#B2500F',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        </div>
      )}

      {/* Mensaje de error general si ocurre */}
      {error && (
        <div
          role="alert"
          style={{
            margin: '12px 16px 0 16px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: '#FDE8E8',
            border: '1px solid #B2500F',
            color: '#B2500F',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Cuerpo principal */}
      <main style={{ padding: '16px', flex: 1 }}>
        {cargando ? (
          <div
            role="status"
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              color: '#5A6E78',
              fontWeight: 700,
            }}
          >
            Cargando información de reparto...
          </div>
        ) : pestana === 'mi_ruta' ? (
          /* ============================================================ */
          /* PESTAÑA 1: MI RUTA (PEDIDOS TOMADOS DEL REPARTIDOR)          */
          /* ============================================================ */
          <div
            data-testid="contenido-mi-ruta"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {pedidosActivos.length === 0 ? (
              <div
                data-testid="estado-vacio-mi-ruta"
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #E3D6C6',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#0B2C3E',
                  }}
                >
                  No tienes pedidos activos
                </h3>
                <p
                  style={{
                    margin: '0 0 20px 0',
                    fontSize: '14px',
                    color: '#5A6E78',
                  }}
                >
                  Elige pedidos de la ruta sugerida para comenzar tus entregas.
                </p>
                <button
                  type="button"
                  data-testid="btn-ir-a-elegir"
                  onClick={() => setPestana('para_elegir')}
                  style={{
                    minHeight: '48px',
                    padding: '0 24px',
                    background: '#E67929',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(230, 121, 41, 0.25)',
                  }}
                >
                  Ir a Para elegir
                </button>
              </div>
            ) : (
              pedidosActivos.map((pedido, idx) => {
                const infoEspera = clasificarEspera(pedido.minutosEspera, config);
                const esEnCamino = pedido.estado === 'EN_CAMINO';
                const haLlegado = Boolean(pedido.llego_en);
                const tieneCobroEfectivo =
                  pedido.pago_estado !== 'PAGADO' &&
                  (pedido.pago_metodo === 'EFECTIVO' || pedido.pago_metodo === 'efectivo');

                return (
                  <article
                    key={pedido.id}
                    data-testid={`tarjeta-pedido-${pedido.id}`}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1.5px solid #E3D6C6',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
                    }}
                  >
                    {/* Encabezado de la tarjeta */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        borderBottom: '1px solid #F4ECE1',
                        paddingBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            background: '#0B2C3E',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 800,
                            borderRadius: '8px',
                            padding: '4px 8px',
                          }}
                        >
                          Parada #{idx + 1}
                        </span>
                        <strong style={{ fontSize: '16px', color: '#0B2C3E' }}>
                          {pedido.codigo}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            background: esEnCamino ? '#D99E39' : '#FBF4EC',
                            color: esEnCamino ? '#0B2C3E' : '#5A6E78',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {esEnCamino ? (haLlegado ? 'En destino' : 'En camino') : 'Listo en tienda'}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            background: infoEspera.colorHex,
                            color: '#FFFFFF',
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {pedido.minutosEspera} min
                        </span>
                      </div>
                    </div>

                    {/* Dirección y Zona */}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0B2C3E' }}>
                        {pedido.direccion || 'Dirección sin especificar'}
                      </div>
                      {pedido.referencia && (
                        <div style={{ fontSize: '12px', color: '#5A6E78', marginTop: '2px' }}>
                          Ref: {pedido.referencia}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#B2500F',
                          marginTop: '4px',
                        }}
                      >
                        Zona: {pedido.zona || 'Local / General'}
                      </div>
                    </div>

                    {/* Teléfono del cliente y enlaces de comunicación (VISIBLE tras tomar) */}
                    <div
                      style={{
                        background: '#FBF4EC',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0B2C3E' }}>
                        Cliente: {pedido.cliente_nombre || 'Cliente'}
                      </div>
                      <div
                        data-testid={`telefono-cliente-${pedido.id}`}
                        style={{ fontSize: '13px', color: '#0B2C3E' }}
                      >
                        Teléfono:{' '}
                        <strong>
                          {pedido.cliente_telefono ? pedido.cliente_telefono : 'No registrado'}
                        </strong>
                      </div>

                      {pedido.cliente_telefono && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                          <a
                            href={`tel:${pedido.cliente_telefono}`}
                            style={{
                              minHeight: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#FFFFFF',
                              border: '1.5px solid #0B2C3E',
                              borderRadius: '10px',
                              color: '#0B2C3E',
                              fontWeight: 800,
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                          >
                            Llamar
                          </a>
                          <a
                            href={`https://wa.me/51${pedido.cliente_telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              minHeight: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#2F7A45',
                              border: 'none',
                              borderRadius: '10px',
                              color: '#FFFFFF',
                              fontWeight: 800,
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                          >
                            WhatsApp
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Detalle de Cobro y Productos */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        padding: '4px 0',
                      }}
                    >
                      <div>
                        <span>Productos: </span>
                        <strong>{pedido.cantidad_productos ?? 1}</strong>
                      </div>
                      <div>
                        <span>Total: </span>
                        <strong style={{ fontSize: '15px' }}>
                          S/ {Number(pedido.total || 0).toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: tieneCobroEfectivo ? '#FFF4E5' : '#E8F5E9',
                        color: tieneCobroEfectivo ? '#B2500F' : '#2F7A45',
                        border: `1px solid ${tieneCobroEfectivo ? '#E67929' : '#2F7A45'}`,
                      }}
                    >
                      {tieneCobroEfectivo
                        ? `Cobrar en efectivo: S/ ${Number(pedido.total).toFixed(2)}${
                            pedido.paga_con ? ` (Paga con S/ ${Number(pedido.paga_con).toFixed(2)})` : ''
                          }`
                        : `Ya pagado con ${pedido.pago_metodo || 'digital'}`}
                    </div>

                    {/* Botones de navegación GPS */}
                    {pedido.lat != null && pedido.lng != null && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            minHeight: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#F4ECE1',
                            border: '1px solid #E3D6C6',
                            borderRadius: '10px',
                            color: '#0B2C3E',
                            fontWeight: 700,
                            fontSize: '12px',
                            textDecoration: 'none',
                          }}
                        >
                          Google Maps
                        </a>
                        <a
                          href={`https://waze.com/ul?ll=${pedido.lat},${pedido.lng}&navigate=yes`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            minHeight: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#F4ECE1',
                            border: '1px solid #E3D6C6',
                            borderRadius: '10px',
                            color: '#0B2C3E',
                            fontWeight: 700,
                            fontSize: '12px',
                            textDecoration: 'none',
                          }}
                        >
                          Waze
                        </a>
                      </div>
                    )}

                    {/* Botones de acción principales por etapa (Mínimo 48px de alto) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {!esEnCamino ? (
                        <button
                          type="button"
                          data-testid={`btn-salir-${pedido.id}`}
                          onClick={() => handleSalir(pedido)}
                          style={{
                            minHeight: '48px',
                            background: '#E67929',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Salir a reparto
                        </button>
                      ) : !haLlegado ? (
                        <button
                          type="button"
                          data-testid={`btn-llegue-${pedido.id}`}
                          onClick={() => handleLlegue(pedido)}
                          style={{
                            minHeight: '48px',
                            background: '#D99E39',
                            color: '#0B2C3E',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Llegué a destino
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`btn-entregar-${pedido.id}`}
                          onClick={() => handleEntregar(pedido)}
                          style={{
                            minHeight: '48px',
                            background: '#2F7A45',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Entregar pedido
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`btn-reportar-${pedido.id}`}
                        onClick={() => setPedidoParaFalla(pedido)}
                        style={{
                          minHeight: '48px',
                          background: 'transparent',
                          color: '#B2500F',
                          border: '1.5px solid #B2500F',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Reportar problema
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : pestana === 'para_elegir' ? (
          /* ============================================================ */
          /* PESTAÑA 2: PARA ELEGIR (RUTA SUGERIDA Y TOMA ATÓMICA)         */
          /* ============================================================ */
          <div
            data-testid="contenido-para-elegir"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Resumen de ruta recalculada de los pedidos seleccionados */}
            {seleccionadosIds.size > 0 && metricasElegidos && (
              <div
                data-testid="resumen-ruta-elegida"
                style={{
                  background: '#0B2C3E',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800 }}>
                    Ruta recalculada ({seleccionadosIds.size} elegidos):
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#FBF4EC',
                    }}
                  >
                    ~{metricasElegidos.tiempoAproxMin} min · {metricasElegidos.distanciaAproxKm} km
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#D99E39', fontWeight: 700 }}>
                  Orden de paradas sugerido:{' '}
                  {pedidosElegidosOrdenados.map((p, idx) => `${idx + 1}. ${p.codigo}`).join(' → ')}
                </div>

                <button
                  type="button"
                  data-testid="btn-tomar-elegidos"
                  onClick={handleTomarElegidos}
                  style={{
                    minHeight: '48px',
                    marginTop: '6px',
                    background: '#E67929',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(230, 121, 41, 0.3)',
                  }}
                >
                  Tomar {seleccionadosIds.size} pedido(s) e Iniciar Ruta
                </button>
              </div>
            )}

            {rutaSugeridaDisponibles.length === 0 ? (
              <div
                data-testid="estado-vacio-para-elegir"
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #E3D6C6',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#0B2C3E',
                  }}
                >
                  No hay pedidos listos para reparto
                </h3>
                <p
                  style={{
                    margin: '0',
                    fontSize: '14px',
                    color: '#5A6E78',
                  }}
                >
                  Los pedidos aparecerán aquí tan pronto cocina termine de prepararlos.
                </p>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#5A6E78',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Ruta sugerida disponible:</span>
                  <span>
                    Cupo disponible: {maxPedidos - pedidosActivos.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {rutaSugeridaDisponibles.map((pedido) => {
                    const seleccionado = seleccionadosIds.has(pedido.id);
                    const infoEspera = clasificarEspera(pedido.minutosEspera, config);
                    const esEfectivo =
                      pedido.pago_estado !== 'PAGADO' &&
                      (pedido.pago_metodo === 'EFECTIVO' || pedido.pago_metodo === 'efectivo');

                    return (
                      <article
                        key={pedido.id}
                        data-testid={`candidato-pedido-${pedido.id}`}
                        onClick={() => toggleSeleccion(pedido.id)}
                        style={{
                          background: seleccionado ? '#FBF4EC' : '#FFFFFF',
                          borderRadius: '16px',
                          border: seleccionado ? '2px solid #E67929' : '1.5px solid #E3D6C6',
                          padding: '14px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: seleccionado
                            ? '0 4px 14px rgba(230, 121, 41, 0.15)'
                            : '0 2px 6px rgba(11, 44, 62, 0.04)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={() => {}} // Manejado por onClick del contenedor
                              style={{ width: '20px', height: '20px', accentColor: '#E67929' }}
                            />
                            <strong style={{ fontSize: '16px', color: '#0B2C3E' }}>
                              {pedido.codigo}
                            </strong>
                          </div>

                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              background: infoEspera.colorHex,
                              color: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {pedido.minutosEspera} min
                          </span>
                        </div>

                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0B2C3E' }}>
                            {pedido.direccion || 'Dirección aproximada'}
                          </div>
                          {pedido.referencia && (
                            <div style={{ fontSize: '12px', color: '#5A6E78', marginTop: '2px' }}>
                              Ref: {pedido.referencia}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#B2500F',
                              marginTop: '2px',
                            }}
                          >
                            Zona: {pedido.zona || 'Local / General'}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '13px',
                            borderTop: '1px solid #F4ECE1',
                            paddingTop: '8px',
                          }}
                        >
                          <span>Productos: <strong>{pedido.cantidad_productos ?? 1}</strong></span>
                          <span>
                            Total:{' '}
                            <strong style={{ fontSize: '14px' }}>
                              S/ {Number(pedido.total || 0).toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: esEfectivo ? '#B2500F' : '#2F7A45',
                          }}
                        >
                          {esEfectivo
                            ? `Cobrar en efectivo al entregar: S/ ${Number(pedido.total).toFixed(2)}`
                            : 'Ya pagado digitalmente'}
                        </div>

                        <div
                          data-testid={`telefono-oculto-${pedido.id}`}
                          style={{
                            fontSize: '12px',
                            color: '#5A6E78',
                            fontStyle: 'italic',
                          }}
                        >
                          Teléfono oculto hasta tomar
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* PESTAÑA 3: HECHOS HOY (ENTREGAS COMPLETADAS Y LIQUIDACIÓN)    */
          /* ============================================================ */
          <div
            data-testid="contenido-hechos-hoy"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Tarjeta de resumen de liquidación en efectivo */}
            <div
              data-testid="resumen-liquidacion"
              style={{
                background: '#FBF4EC',
                border: '1.5px solid #E3D6C6',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#5A6E78' }}>
                Resumen del turno de hoy:
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: '14px', color: '#0B2C3E', fontWeight: 700 }}>
                  Entregas completadas:
                </span>
                <span
                  data-testid="conteo-hechos-hoy"
                  style={{ fontSize: '18px', color: '#0B2C3E', fontWeight: 900 }}
                >
                  {hechosHoy.length}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  borderTop: '1px solid #E3D6C6',
                  paddingTop: '8px',
                }}
              >
                <span style={{ fontSize: '14px', color: '#B2500F', fontWeight: 800 }}>
                  Total cobrado en efectivo para liquidar:
                </span>
                <span
                  data-testid="total-efectivo-liquidar"
                  style={{ fontSize: '20px', color: '#B2500F', fontWeight: 900 }}
                >
                  S/ {totalEfectivoHoy.toFixed(2)}
                </span>
              </div>
            </div>

            {hechosHoy.length === 0 ? (
              <div
                data-testid="estado-vacio-hechos-hoy"
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #E3D6C6',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#0B2C3E',
                  }}
                >
                  Aún no tienes entregas completadas hoy
                </h3>
                <p style={{ margin: '0', fontSize: '14px', color: '#5A6E78' }}>
                  Tus pedidos entregados aparecerán aquí para tu control y rendición en caja.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hechosHoy.map((pedido) => (
                  <article
                    key={pedido.id}
                    data-testid={`hecho-pedido-${pedido.id}`}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E3D6C6',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong style={{ fontSize: '15px', color: '#0B2C3E' }}>
                        {pedido.codigo}
                      </strong>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          background: '#E8F5E9',
                          color: '#2F7A45',
                          borderRadius: '6px',
                          padding: '2px 8px',
                        }}
                      >
                        Entregado
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#0B2C3E' }}>
                      {pedido.cliente_nombre && (
                        <div style={{ fontWeight: 700 }}>{pedido.cliente_nombre}</div>
                      )}
                      <div>{pedido.direccion || 'Dirección de entrega'}</div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#5A6E78',
                        borderTop: '1px solid #F4ECE1',
                        paddingTop: '6px',
                      }}
                    >
                      <span>
                        Pago: <strong>{pedido.pago_metodo || 'EFECTIVO'}</strong>
                      </span>
                      <strong style={{ color: '#0B2C3E', fontSize: '14px' }}>
                        S/ {Number(pedido.total || 0).toFixed(2)}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de confirmación genérico Sí/No */}
      <Confirmar
        abierto={confirmacion.abierto}
        titulo={confirmacion.titulo}
        mensaje={confirmacion.mensaje}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        peligro={confirmacion.peligro}
        cargando={ejecutandoAccion}
        alConfirmar={ejecutarAccionConfirmada}
        alCancelar={() => setConfirmacion((prev) => ({ ...prev, abierto: false }))}
      />

      {/* Modal para reportar falla / incidente de entrega */}
      {pedidoParaFalla && (
        <ModalReportarFalla
          pedido={pedidoParaFalla}
          alCerrar={() => setPedidoParaFalla(null)}
          alCompletar={async () => {
            setPedidoParaFalla(null);
            await cargarDatos();
          }}
        />
      )}
    </div>
  );
}
