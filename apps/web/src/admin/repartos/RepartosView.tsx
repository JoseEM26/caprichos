import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { useEsMovil } from '../../carta/useEsMovil';
import { MapaRepartos, PuntoRepartoMapa } from './MapaRepartos';
import { TarjetaReparto } from './TarjetaReparto';
import { ResumenPedidoReparto } from './ResumenPedidoReparto';
import { ModalSoltarPedido } from './ModalSoltarPedido';
import { TodosLosPedidos } from './TodosLosPedidos';
import { esMiPedido } from './esMiPedido';
import { useAccionesReparto } from './useAccionesReparto';
import { clasificarEspera, ConfigReparto, CONFIG_REPARTO_DEFECTO } from './calculoRuta';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';
import { nombreClienteVisible } from './textoVisible';
import { repartosApi, PedidoReparto, PedidoSeguimiento, PanelRepartidores as DatosPanel } from './repartosApi';
import { PanelRepartidores } from './PanelRepartidores';
import { RepartidorView } from './RepartidorView';
import { RutasAdmin } from './RutasAdmin';
import { ContadoresDeliveryChips, useContadoresDelivery } from './ContadoresDelivery';

type Vista = 'panel' | 'todos' | 'mapa' | 'rutas';

const PESTANAS: Array<{ clave: Vista; texto: string }> = [
  { clave: 'panel', texto: 'Repartidores' },
  { clave: 'todos', texto: 'Todos los pedidos' },
  { clave: 'mapa', texto: 'Mapa' },
  { clave: 'rutas', texto: 'Rutas' },
];

/**
 * Seguimiento de repartos para ADMIN, SUPERVISOR, CAJERO y MOZO: qué entrega y lleva cada repartidor.
 * Nadie asigna pedidos aquí (el repartidor decide sus rutas): el ADMIN puede tomar como uno más y
 * ADMIN/CAJERO tienen la excepción «Soltar / reasignar».
 */
function SeguimientoRepartosView() {
  const { tiene, usuario } = useSesion();
  const [searchParams, setSearchParams] = useSearchParams();
  const movil = useEsMovil();

  const esAdmin = usuario?.rol === 'ADMIN';
  const puedeTomar = esAdmin && tiene('repartos/tomar');
  const puedeSoltar = (esAdmin || usuario?.rol === 'CAJERO') && tiene('repartos/liquidar');
  const puedeLiquidar = tiene('repartos/liquidar');

  const vistaUrl = searchParams.get('vista');
  const vista: Vista = vistaUrl === 'todos' || vistaUrl === 'lista' || vistaUrl === 'mios' ? 'todos' : vistaUrl === 'mapa' ? 'mapa' : vistaUrl === 'rutas' ? 'rutas' : 'panel';

  const [config, setConfig] = useState<ConfigReparto>(CONFIG_REPARTO_DEFECTO);
  const [zonasGeo, setZonasGeo] = useState<ZonaGeoItem[]>(ZONAS_GEO_DEFECTO);
  const [panel, setPanel] = useState<DatosPanel | null>(null);
  const [pedidos, setPedidos] = useState<PedidoSeguimiento[]>([]);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);
  const [soltando, setSoltando] = useState<PedidoReparto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      const [pan, seg, cfg, zGeo] = await Promise.all([
        repartosApi.obtenerPanel().catch(() => null),
        repartosApi.obtenerSeguimiento().catch(() => null),
        repartosApi.obtenerConfig().catch(() => CONFIG_REPARTO_DEFECTO),
        repartosApi.obtenerZonasPoligonos().catch(() => ZONAS_GEO_DEFECTO),
      ]);
      if (!pan && !seg) throw new Error('No se pudo cargar el seguimiento de repartos');
      setPanel(pan);
      // Los nombres se limpian una sola vez: ningún teléfono ni número largo llega a la pantalla
      setPedidos((seg?.pedidos ?? []).map((p) => ({ ...p, cliente_nombre: nombreClienteVisible(p.cliente_nombre) })));
      if (cfg) setConfig(cfg);
      if (zGeo) setZonasGeo(zGeo);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los repartos');
    } finally {
      setCargando(false);
    }
  }, []);

  const contadores = useContadoresDelivery();
  const acciones = useAccionesReparto({ alActualizar: cargarDatos });

  useEffect(() => {
    setCargando(true);
    cargarDatos();
  }, [cargarDatos]);

  // Tiempo real: los mismos eventos y sondeo de siempre
  useEventos('pedido:estado', () => cargarDatos());
  useEventos('reparto:incidente', () => cargarDatos());
  useTiempoReal(['reparto:rutas', 'pedido:nuevo', 'pedido:pago'], () => cargarDatos());

  const pedidoSeleccionado = useMemo(() => {
    if (!pedidoSeleccionadoId) return null;
    return (
      pedidos.find((p) => p.id === pedidoSeleccionadoId) ||
      panel?.sin_tomar.find((p) => p.id === pedidoSeleccionadoId) ||
      panel?.repartidores.flatMap((r) => r.pedidos).find((p) => p.id === pedidoSeleccionadoId) ||
      null
    );
  }, [pedidoSeleccionadoId, pedidos, panel]);

  const vivos = useMemo(() => pedidos.filter((p) => p.seccion === 'ESPERANDO' || p.seccion === 'EN_CAMINO'), [pedidos]);

  const conteosPorZona = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of vivos) if (p.zona) m[p.zona] = (m[p.zona] || 0) + 1;
    return m;
  }, [vivos]);

  const puntosMapa: PuntoRepartoMapa[] = useMemo(
    () =>
      vivos
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          id: p.id,
          lat: p.lat!,
          lng: p.lng!,
          etiqueta: p.cliente_nombre,
          codigo: p.codigo,
          detalle: p.repartidor?.nombre ? `lo lleva ${p.repartidor.nombre.split(' ')[0]}` : 'sin repartidor',
          color: clasificarEspera(p.minutosEspera, config).color,
          minutosEspera: p.minutosEspera,
          enReparto: !!p.repartidor_party_id,
        })),
    [vivos, config],
  );

  const cambiarVista = (v: Vista) => {
    setPedidoSeleccionadoId(null);
    setSearchParams({ vista: v });
  };

  const sinTomar = panel?.sin_tomar.length ?? pedidos.filter((p) => p.seccion === 'ESPERANDO').length;

  const hoja = pedidoSeleccionado && (
    pedidoSeleccionado.motivo_falla && puedeLiquidar ? (
      <TarjetaReparto
        pedido={pedidoSeleccionado}
        esMio={esMiPedido(pedidoSeleccionado, usuario?.partyId)}
        puedeLiquidar={puedeLiquidar}
        alSoltar={puedeSoltar ? setSoltando : undefined}
        alActualizar={cargarDatos}
      />
    ) : (
      <ResumenPedidoReparto
        pedido={pedidoSeleccionado}
        esMio={esMiPedido(pedidoSeleccionado, usuario?.partyId)}
        esDisponible={pedidoSeleccionado.estado === 'LISTO' && !pedidoSeleccionado.repartidor_party_id && !pedidoSeleccionado.motivo_falla}
        puedeTomar={puedeTomar}
        alSoltar={puedeSoltar ? setSoltando : undefined}
        alCerrar={() => setPedidoSeleccionadoId(null)}
        alActualizar={cargarDatos}
        acciones={acciones}
      />
    )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box', paddingBottom: 20 }}>
      <div
        role="group"
        aria-label="Vistas del seguimiento de repartos"
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: 2, alignSelf: 'flex-start', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 12, background: 'var(--cp-cream, #FFFDF8)' }}
      >
        {PESTANAS.map((t) => (
          <button
            key={t.clave}
            type="button"
            aria-pressed={vista === t.clave}
            onClick={() => cambiarVista(t.clave)}
            style={{
              minHeight: 36,
              padding: '0 14px',
              borderRadius: 9,
              border: 'none',
              background: vista === t.clave ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
              color: vista === t.clave ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t.texto}
          </button>
        ))}
      </div>

      <ContadoresDeliveryChips datos={contadores} />

      <div
        role="status"
        data-testid="contador-cola-espera"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: sinTomar > 0 ? '#EFF6FF' : 'var(--cp-cream, #FFFDF8)', border: '1.5px solid var(--cp-line, #E3D6C6)', borderRadius: 12, fontSize: 13, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: sinTomar > 0 ? 'var(--cp-orange, #E67929)' : 'var(--cp-green, #2F7A45)' }} />
        {sinTomar} {sinTomar === 1 ? 'pedido esperando repartidor' : 'pedidos esperando repartidor'}
      </div>

      {vista === 'rutas' ? (
        <RutasAdmin />
      ) : cargando ? (
        <div style={{ padding: '60px 0' }}>
          <Cargando mensaje="Cargando pedidos de reparto..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      ) : vista === 'panel' ? (
        panel ? (
          <PanelRepartidores panel={panel} config={config} alAbrir={setPedidoSeleccionadoId} />
        ) : (
          <EstadoError mensaje="No se pudo cargar el panel de repartidores." alReintentar={cargarDatos} />
        )
      ) : vista === 'todos' ? (
        <TodosLosPedidos pedidos={pedidos} config={config} alAbrir={setPedidoSeleccionadoId} />
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--cp-soft, #5A6E78)' }}>
            Pin con anillo: ya lo lleva un repartidor (su nombre sale en la etiqueta). Pin sin anillo: «sin repartidor». Color: minutos de espera.
          </p>
          <MapaRepartos
            puntos={puntosMapa}
            zonas={zonasGeo}
            conteoPorZona={conteosPorZona}
            seleccionadoId={pedidoSeleccionadoId}
            onSeleccionarPunto={(id) => setPedidoSeleccionadoId((prev) => (prev === id ? null : id))}
            altura={movil ? 'calc(100vh - 220px)' : 'min(65vh, 600px)'}
          />
        </>
      )}

      {vista !== 'rutas' && hoja}

      {soltando && (
        <ModalSoltarPedido
          pedido={soltando}
          repartidores={panel?.repartidores ?? []}
          alCerrar={() => setSoltando(null)}
          alTerminar={() => {
            setSoltando(null);
            setPedidoSeleccionadoId(null);
            cargarDatos();
          }}
        />
      )}

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

export function RepartosView() {
  const { tiene, usuario } = useSesion();
  const puedeVer = tiene('repartos/ver') || tiene('repartos/seguir');
  const puedeLiquidar = tiene('repartos/liquidar');
  const esRolRepartidor = usuario?.rol === 'REPARTIDOR';

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de repartos." />
      </div>
    );
  }

  if (esRolRepartidor && !puedeLiquidar) {
    return <RepartidorView />;
  }

  return <SeguimientoRepartosView />;
}
