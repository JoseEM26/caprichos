import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { Confirmar } from '../../comun/Confirmar';
import { useEsMovil } from '../../carta/useEsMovil';
import { MapaRepartos, PuntoRepartoMapa } from './MapaRepartos';
import { TarjetaReparto } from './TarjetaReparto';
import { ResumenPedidoReparto } from './ResumenPedidoReparto';
import { PanelRutaSugerida } from './PanelRutaSugerida';
import { OpcionesRutaSugerida, colorOpcion } from './OpcionesRutaSugerida';
import { useRutasSugeridas } from './useRutasSugeridas';
import { esMiPedido } from './esMiPedido';
import { useAccionesReparto } from './useAccionesReparto';
import {
  clasificarEspera,
  sugerirOrdenRuta,
  calcularMetricasRuta,
  sugerirRutasPorSector,
  RutaSugeridaSector,
  ConfigReparto,
  CONFIG_REPARTO_DEFECTO,
  COORDENADAS_TIENDA_DEFECTO,
  NivelEspera,
  PedidoParaRuta,
} from './calculoRuta';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';
import { nombreClienteVisible } from './textoVisible';
import {
  repartosApi,
  PedidoReparto,
  ResumenRepartos,
  RespuestaMios,
  PedidoPerdido,
  PanelRepartidores as DatosPanel,
} from './repartosApi';
import { PanelRepartidores } from './PanelRepartidores';
import { RepartidorView } from './RepartidorView';
import { RutasAdmin } from './RutasAdmin';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';

type ModoVista = 'mapa' | 'lista' | 'rutas' | 'panel';
type FiltroRetraso = 'todos' | NivelEspera;


function RepartosAdminView() {
  const { tiene, usuario } = useSesion();
  const [searchParams, setSearchParams] = useSearchParams();
  const movil = useEsMovil();

  const puedeVer = tiene('repartos/ver');
  const puedeLiquidar = tiene('repartos/liquidar');
  const esRolRepartidor = usuario?.rol === 'REPARTIDOR';
  const puedeTomarRuta = tiene('repartos/tomar');

  // Configuración de reparto (umbrales y velocidad media)
  const [config, setConfig] = useState<ConfigReparto>(CONFIG_REPARTO_DEFECTO);

  // Polígonos de zonas de reparto (Decisión 5)
  const [zonasGeo, setZonasGeo] = useState<ZonaGeoItem[]>(ZONAS_GEO_DEFECTO);

  // Modo de vista: 'mapa' por defecto; sincronizado con URL si viene ?vista=lista o ?vista=mios
  const vistaUrl = searchParams.get('vista');
  const [modoVista, setModoVista] = useState<ModoVista>(
    vistaUrl === 'rutas' ? 'rutas' : vistaUrl === 'panel' && !esRolRepartidor ? 'panel' : vistaUrl === 'lista' || vistaUrl === 'mios' ? 'lista' : 'mapa',
  );

  // Filtro de rol / repartidor: arranca en 'all' ("Todos (caja)") o el id del repartidor
  const [filtroRider, setFiltroRider] = useState<string>('all');
  const destinoAdmin = filtroRider !== 'all' ? filtroRider : undefined;

  // Filtro de zona: arranca en 'todas'
  const [filtroZona, setFiltroZona] = useState<string>('todas');

  // Tres filtros de tiempo de espera (Decisión 3 del dueño: Retrasado, Tarde, Muy tarde)
  const [filtroRetraso, setFiltroRetraso] = useState<FiltroRetraso>('todos');

  // Estado de pantalla completa (Decisión 2 del dueño)
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [panelRutaAbierto, setPanelRutaAbierto] = useState(false);

  // Modal de ayuda rápida "¿Cómo funciona?" (Decisión 1 del dueño)
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  // Datos de la API
  const [disponibles, setDisponibles] = useState<PedidoReparto[]>([]);
  const [datosMios, setDatosMios] = useState<RespuestaMios>({
    pedidos: [],
    orden: [],
    paso: [],
    ruta: [],
  });
  const [todos, setTodos] = useState<PedidoReparto[]>([]);
  const [, setResumen] = useState<ResumenRepartos | null>(null);
  const [panel, setPanel] = useState<DatosPanel | null>(null);

  // Selección de pedido para la hoja inferior (Decisión 7)
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Paradas de ruta seleccionadas manualmente o por sugerencia (Decisión 4)
  const [paradasRutaIds, setParadasRutaIds] = useState<string[]>([]);
  const [ordenManualRuta, setOrdenManualRuta] = useState<string[]>([]);

  // Rutas sugeridas por sector (Decisión firmada)
  const [mostrarRutasSugeridas, setMostrarRutasSugeridas] = useState(false);
  const [rutaSugeridaActivaId, setRutaSugeridaActivaId] = useState<string | null>(null);
  const [avisosPerdidos, setAvisosPerdidos] = useState<PedidoPerdido[]>([]);
  const [cargandoInicioRuta, setCargandoInicioRuta] = useState(false);

  // Estados de carga
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Actualizar modo de vista si cambia la URL (Decisión 6: navegación por botones del celular)
  useEffect(() => {
    if (vistaUrl === 'mapa') {
      setModoVista('mapa');
    } else if (vistaUrl === 'lista' || vistaUrl === 'mios') {
      setModoVista('lista');
    } else if (vistaUrl === 'panel' && !esRolRepartidor) {
      setModoVista('panel');
    }
  }, [vistaUrl, esRolRepartidor]);

  // La pantalla completa es este estado: que el navegador salga de su Fullscreen API no la cierra.
  const alternarPantallaCompleta = () => {
    if (!pantallaCompleta) {
      Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => {});
      setPantallaCompleta(true);
    } else {
      if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
      setPantallaCompleta(false);
    }
  };

  const cargarDatos = useCallback(async () => {
    if (!puedeVer) return;
    setError(null);

    try {
      const [disp, res, mios, tod, cfg, zGeo, pan] = await Promise.all([
        repartosApi.listarDisponibles().catch(() => []),
        repartosApi.obtenerResumen().catch(() => null),
        repartosApi.listarMios().catch(() => ({ pedidos: [], orden: [], paso: [], ruta: [] })),
        repartosApi.listarTodos().catch(() => []),
        repartosApi.obtenerConfig().catch(() => CONFIG_REPARTO_DEFECTO),
        repartosApi.obtenerZonasPoligonos().catch(() => ZONAS_GEO_DEFECTO),
        // Solo Caja/Admin: al REPARTIDOR el servidor le responde 403
        esRolRepartidor ? Promise.resolve(null) : repartosApi.obtenerPanel().catch(() => null),
      ]);

      // Los nombres se limpian aquí una sola vez: ningún teléfono ni número largo llega a la pantalla
      const sinNumeros = <T extends { cliente_nombre: string }>(lista: T[]) =>
        lista.map((p) => ({ ...p, cliente_nombre: nombreClienteVisible(p.cliente_nombre) }));

      setDisponibles(sinNumeros(disp));
      setResumen(res);
      setDatosMios({ ...mios, pedidos: sinNumeros(mios.pedidos) });
      setTodos(sinNumeros(tod));
      if (cfg) setConfig(cfg);
      if (zGeo) setZonasGeo(zGeo);
      setPanel(pan);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los repartos');
    } finally {
      setCargando(false);
    }
  }, [puedeVer, esRolRepartidor]);

  const acciones = useAccionesReparto({ alActualizar: cargarDatos });

  useEffect(() => {
    setCargando(true);
    setPedidoSeleccionadoId(null);
    cargarDatos();
  }, [cargarDatos]);

  const sugeridas = useRutasSugeridas(puedeVer);

  // Actualización en vivo vía Socket.IO
  useEventos('pedido:estado', () => {
    cargarDatos();
    sugeridas.recargar();
  });

  useEventos('reparto:incidente', () => {
    cargarDatos();
  });

  // Rutas, ubicación y cobros, más respaldo (reconexión, volver a la pestaña, sondeo sin socket); recarga en silencio
  useTiempoReal(['reparto:rutas', 'pedido:nuevo', 'pedido:pago'], () => {
    cargarDatos();
    sugeridas.recargar();
  });

  // Lista consolidada de pedidos según rol y selección "Ver como:"
  const pedidosBase = useMemo(() => {
    // Solo pedidos de reparto vivos: LISTO (esperando o asignado) y EN_CAMINO
    const todosLista = (todos.length > 0 ? todos : [...disponibles, ...datosMios.pedidos]).filter(
      (o) => o.estado === 'LISTO' || o.estado === 'EN_CAMINO',
    );

    if (esRolRepartidor && !puedeLiquidar) {
      return todosLista.filter(
        (o) =>
          (o.estado === 'LISTO' && !o.repartidor_party_id) ||
          esMiPedido(o, usuario?.partyId) ||
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
        (!rId && o.estado === 'LISTO')
      );
    });
  }, [todos, disponibles, datosMios, esRolRepartidor, puedeLiquidar, filtroRider, usuario]);

  // Conteos para los 3 filtros de espera superiores (Decisión 3 del dueño)
  const conteosEspera = useMemo(() => {
    let retrasados = 0;
    let tardes = 0;
    let muyTardes = 0;

    for (const p of pedidosBase) {
      if (p.estado === 'ENTREGADO') continue;
      const info = clasificarEspera(p.minutosEspera, config);
      if (info.nivel === 'retrasado') retrasados++;
      else if (info.nivel === 'tarde') tardes++;
      else if (info.nivel === 'muy_tarde') muyTardes++;
    }

    return { retrasados, tardes, muyTardes };
  }, [pedidosBase, config]);

  // Filtrado de pedidos según zona y filtro de espera
  const pedidosFiltrados = useMemo(() => {
    let lista = pedidosBase;

    // Filtro por zona
    if (filtroZona !== 'todas') {
      lista = lista.filter((p) => p.zona === filtroZona);
    }

    // Filtro por tiempo de retraso (Decisión 3 del dueño)
    if (filtroRetraso !== 'todos') {
      lista = lista.filter((p) => {
        const info = clasificarEspera(p.minutosEspera, config);
        return info.nivel === filtroRetraso;
      });
    }

    return lista;
  }, [pedidosBase, filtroZona, filtroRetraso, config]);

  // Conteos por zona para el sombreado y las pastillas (Decisión 5)
  const conteosPorZona = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const p of pedidosBase) {
      if (p.zona && p.estado !== 'ENTREGADO') {
        mapa[p.zona] = (mapa[p.zona] || 0) + 1;
      }
    }
    return mapa;
  }, [pedidosBase]);

  // Candidatos para la ruta sugerida (pedidos listos y pedidos que ya van en camino)
  const pedidosCandidatosRuta = useMemo((): PedidoParaRuta[] => {
    return pedidosBase
      .filter((p) => {
        if (p.lat == null || p.lng == null) return false;
        if (p.estado === 'ENTREGADO') return false;
        // Pedidos listos o pedidos que ya van en camino del repartidor
        return (
          p.estado === 'LISTO' ||
          p.estado === 'EN_CAMINO' ||
          datosMios.pedidos.some((m) => m.id === p.id)
        );
      })
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente_nombre: p.cliente_nombre,
        direccion: p.direccion,
        lat: p.lat!,
        lng: p.lng!,
        minutosEspera: p.minutosEspera,
        zona: p.zona,
        estado: p.estado,
        total: p.total,
        pago_metodo: p.pago_metodo,
        pago_estado: p.pago_estado,
        paga_con: p.paga_con,
      }));
  }, [pedidosBase, datosMios.pedidos]);

  // Candidatos para rutas sugeridas por sector: pedidos disponibles con coordenadas
  const pedidosParaSectores = useMemo((): PedidoParaRuta[] => {
    return disponibles
      .filter((p) => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng))
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente_nombre: p.cliente_nombre,
        direccion: p.direccion,
        lat: p.lat!,
        lng: p.lng!,
        minutosEspera: p.minutosEspera,
        zona: p.zona,
        estado: p.estado,
        total: p.total,
        pago_metodo: p.pago_metodo,
        pago_estado: p.pago_estado,
        paga_con: p.paga_con,
      }));
  }, [disponibles]);

  // Rutas sugeridas por sector cardinal, más cercana y más urgente (hasta 5)
  const rutasLocales = useMemo(() => {
    return sugerirRutasPorSector(pedidosParaSectores, COORDENADAS_TIENDA_DEFECTO, config);
  }, [pedidosParaSectores, config]);

  // Opciones calculadas por el servidor (todas las pantallas ven lo mismo). Si el servidor no responde,
  // el mapa usa el cálculo local de respaldo.
  const opcionesServidor = sugeridas.datos?.opciones ?? [];
  const rutasSugeridas = useMemo((): RutaSugeridaSector[] => {
    if (!sugeridas.datos) return rutasLocales;
    return opcionesServidor.map((o, i) => ({
      id: o.id,
      nombre: `Ruta hacia el ${o.sector.toLowerCase()}`,
      sector: o.sector,
      color: colorOpcion(i),
      pedidos: [],
      totalPedidos: o.pedidos.length,
      distanciaKm: o.distanciaKm,
      tiempoMin: o.tiempoMin,
      urgencia: o.puntaje,
      coordenadasRuta: o.ruta,
    }));
  }, [sugeridas.datos, opcionesServidor, rutasLocales]);
  const idsResaltados = useMemo(
    () => opcionesServidor.find((o) => o.id === rutaSugeridaActivaId)?.pedidos.map((p) => p.id),
    [opcionesServidor, rutaSugeridaActivaId],
  );

  const rutaActiva = useMemo(() => {
    if (!rutaSugeridaActivaId) return null;
    return rutasSugeridas.find((r) => r.id === rutaSugeridaActivaId) || null;
  }, [rutaSugeridaActivaId, rutasSugeridas]);

  const candidatosParaPanel = useMemo(() => {
    if (rutaActiva && rutaActiva.pedidos.length > 0) {
      return rutaActiva.pedidos;
    }
    return pedidosCandidatosRuta;
  }, [rutaActiva, pedidosCandidatosRuta]);

  // Inicializar paradas sugeridas si no se han seleccionado manualmente
  useEffect(() => {
    if (candidatosParaPanel.length > 0 && paradasRutaIds.length === 0) {
      const sugeridas = sugerirOrdenRuta(
        candidatosParaPanel,
        COORDENADAS_TIENDA_DEFECTO,
        config,
        config.maxPedidosPorRepartidor,
      );
      const ids = sugeridas.map((p) => p.id);
      setParadasRutaIds(ids);
      setOrdenManualRuta(ids);
    }
  }, [candidatosParaPanel, config]);

  // Cálculo de la ruta activa según paradas seleccionadas y su orden
  const rutaCalculada = useMemo(() => {
    const seleccionadosMap = new Map(candidatosParaPanel.map((p) => [p.id, p]));
    const paradasOrdenadas: PedidoParaRuta[] = [];

    // Usar orden manual establecido
    for (const id of ordenManualRuta) {
      if (paradasRutaIds.includes(id) && seleccionadosMap.has(id)) {
        paradasOrdenadas.push(seleccionadosMap.get(id)!);
      }
    }

    // Agregar paradas seleccionadas que aún no estaban en el orden manual
    for (const id of paradasRutaIds) {
      if (!ordenManualRuta.includes(id) && seleccionadosMap.has(id)) {
        paradasOrdenadas.push(seleccionadosMap.get(id)!);
      }
    }

    return calcularMetricasRuta(
      paradasOrdenadas,
      COORDENADAS_TIENDA_DEFECTO,
      config.velocidadMediaKmH,
    );
  }, [candidatosParaPanel, paradasRutaIds, ordenManualRuta, config]);

  // Manejadores para el panel de ruta sugerida
  const handleAlternarSeleccionParada = (id: string) => {
    setParadasRutaIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      } else {
        const limite = config.maxPedidosPorRepartidor ?? 3;
        if (prev.length >= limite) {
          return prev; // No exceder el máximo configurable
        }
        return [...prev, id];
      }
    });
  };

  const handleMoverParada = (origenIdx: number, destinoIdx: number) => {
    if (
      origenIdx < 0 ||
      destinoIdx < 0 ||
      origenIdx >= rutaCalculada.paradas.length ||
      destinoIdx >= rutaCalculada.paradas.length
    ) {
      return;
    }

    const nuevoOrden = [...rutaCalculada.paradas.map((p) => p.id)];
    const [movido] = nuevoOrden.splice(origenIdx, 1);
    nuevoOrden.splice(destinoIdx, 0, movido);
    setOrdenManualRuta(nuevoOrden);
  };

  const handleSeleccionarRutaSugerida = (ruta: RutaSugeridaSector) => {
    setRutaSugeridaActivaId(ruta.id);
    if (sugeridas.datos) return; // opciones del servidor: se toman con «Tomar esta ruta»
    const limite = config.maxPedidosPorRepartidor ?? 3;
    const iniciales = ruta.pedidos.slice(0, limite).map((p) => p.id);
    setParadasRutaIds(iniciales);
    setOrdenManualRuta(ruta.pedidos.map((p) => p.id));
    setPanelRutaAbierto(true);
  };

  const handleIniciarRuta = async (idsAIniciar?: string[]) => {
    const ids = idsAIniciar && idsAIniciar.length > 0 ? idsAIniciar : paradasRutaIds;
    if (ids.length === 0) return;

    setCargandoInicioRuta(true);
    try {
      const res = await repartosApi.iniciarRuta({ pedidoIds: ids });
      if (res.perdidos && res.perdidos.length > 0) {
        setAvisosPerdidos(res.perdidos);
      } else {
        setAvisosPerdidos([]);
      }
      await cargarDatos();

      if (res.tomados && res.tomados.length > 0) {
        if (rutaCalculada.urlGoogleMaps) {
          window.open(rutaCalculada.urlGoogleMaps, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err: any) {
      acciones.setErrorAccion(err?.message || 'Error al iniciar la ruta');
    } finally {
      setCargandoInicioRuta(false);
    }
  };

  // Puntos para el mapa interactivo
  const puntosMapa: PuntoRepartoMapa[] = useMemo(() => {
    const ordenMap = new Map(rutaCalculada.paradas.map((p, idx) => [p.id, idx + 1]));

    return pedidosFiltrados
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => {
        const infoEspera = clasificarEspera(p.minutosEspera, config);
        const numeroOrden = ordenMap.get(p.id);

        // En reparto = EN_CAMINO, o LISTO ya con repartidor asignado; esperando = LISTO sin repartidor
        const enReparto = p.estado === 'EN_CAMINO' || !!p.repartidor_party_id;
        return {
          id: p.id,
          lat: p.lat!,
          lng: p.lng!,
          etiqueta: p.cliente_nombre,
          codigo: p.codigo,
          detalle: p.repartidor?.nombre
            ? `lo lleva ${p.repartidor.nombre.split(' ')[0]}`
            : enReparto
              ? 'en reparto'
              : 'sin repartidor',
          color: infoEspera.color,
          orden: numeroOrden,
          minutosEspera: p.minutosEspera,
          enReparto,
        };
      });
  }, [pedidosFiltrados, rutaCalculada.paradas, config]);

  // Coordenadas para la línea de ruta sugerida en el mapa
  const rutaCoordenadasMapa: Array<[number, number]> = useMemo(() => {
    if (rutaCalculada.paradas.length === 0) return [];
    return [
      [COORDENADAS_TIENDA_DEFECTO.lat, COORDENADAS_TIENDA_DEFECTO.lng],
      ...rutaCalculada.paradas.map((p): [number, number] => [p.lat, p.lng]),
    ];
  }, [rutaCalculada.paradas]);

  // Pedido seleccionado al tocar un marcador
  const pedidoSeleccionado = useMemo(() => {
    if (!pedidoSeleccionadoId) return null;
    return (
      pedidosBase.find((p) => p.id === pedidoSeleccionadoId) ||
      panel?.sin_tomar.find((p) => p.id === pedidoSeleccionadoId) ||
      panel?.repartidores.flatMap((r) => r.pedidos).find((p) => p.id === pedidoSeleccionadoId) ||
      null
    );
  }, [pedidoSeleccionadoId, pedidosBase, panel]);

  // Agrupación por zona para la vista Lista
  // La lista es general: los que más esperan primero; la zona es solo un filtro opcional
  const listaPorEspera = useMemo(
    () => [...pedidosFiltrados].sort((a, b) => (b.minutosEspera ?? 0) - (a.minutosEspera ?? 0)),
    [pedidosFiltrados],
  );

  // Manejador al tocar fondo del mapa para ocultar/mostrar controles en celular
  const handleTocarMapa = () => {
    window.dispatchEvent(new CustomEvent('caprichos:toggle-controles'));
  };

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de repartos." />
      </div>
    );
  }

  return (
    <div
      className={pantallaCompleta ? 'cp-repartos-fullscreen' : ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        paddingBottom: esRolRepartidor && movil ? '80px' : '20px',
        ...(pantallaCompleta
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              padding: '8px 8px 0',
              gap: '8px',
              background: 'var(--cp-cream, #FFFDF8)',
              overflow: 'hidden',
            }
          : {}),
      }}
    >
      {/* 1) FILA SUPERIOR COMPACTA: Selector «Ver como:», alternancia [Mapa] [Lista], Fullscreen y Ayuda «?» */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '0 4px',
        }}
      >
        {/* Selector de Repartidor / Caja (solo para admin/cajero o si puede liquidar) */}
        <BarraFiltros style={{ display: pantallaCompleta ? 'none' : 'flex' }}>
          <FiltroCombo
            etiqueta={esRolRepartidor ? 'Soy' : 'Ver como'}
            valor={filtroRider}
            valorPorDefecto="all"
            opciones={[
              { valor: 'all', etiqueta: !esRolRepartidor || puedeLiquidar ? 'Todos (caja)' : 'Sin elegir' },
              { valor: 'r1', etiqueta: 'Repartidor 1' },
              { valor: 'r2', etiqueta: 'Repartidor 2' },
              { valor: 'r3', etiqueta: 'Repartidor 3' },
            ]}
            alCambiar={(v) => {
              setFiltroRider(v);
              setPedidoSeleccionadoId(null);
            }}
          />
        </BarraFiltros>

        {/* Doble vista [Mapa] [Lista], Botón Pantalla Completa y Botón «?» (Decisiones 1 y 2) */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div
            role="group"
            aria-label="Alternar vista de repartos"
            style={{
              display: 'inline-flex',
              background: 'var(--cp-cream, #FFFDF8)',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: '12px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              aria-pressed={modoVista === 'mapa'}
              onClick={() => {
                setModoVista('mapa');
                setSearchParams({ vista: 'mapa' });
              }}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '9px',
                border: 'none',
                background: modoVista === 'mapa' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: modoVista === 'mapa' ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Mapa
            </button>
            <button
              type="button"
              aria-pressed={modoVista === 'lista'}
              onClick={() => {
                setModoVista('lista');
                setSearchParams({ vista: 'lista' });
              }}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '9px',
                border: 'none',
                background: modoVista === 'lista' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: modoVista === 'lista' ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Lista
            </button>
            <button
              type="button"
              aria-pressed={modoVista === 'rutas'}
              onClick={() => {
                setModoVista('rutas');
                setSearchParams({ vista: 'rutas' });
              }}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '9px',
                border: 'none',
                background: modoVista === 'rutas' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: modoVista === 'rutas' ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Rutas
            </button>
{!esRolRepartidor && (
            <button
              type="button"
              aria-pressed={modoVista === 'panel'}
              onClick={() => {
                setModoVista('panel');
                setSearchParams({ vista: 'panel' });
              }}
              style={{
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '9px',
                border: 'none',
                background: modoVista === 'panel' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: modoVista === 'panel' ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Repartidores
            </button>
)}
          </div>

          {/* Botón Pantalla Completa en PC y Celular (Decisión 2) */}
          <button
            type="button"
            onClick={alternarPantallaCompleta}
            aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            style={{
              minHeight: '40px',
              padding: '0 10px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: pantallaCompleta ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
              color: pantallaCompleta ? 'var(--cp-cream, #FFFDF8)' : 'var(--cp-navy, #0B2C3E)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          {/* Icono «?» pequeño para ayuda (Decisión 1 del dueño) */}
          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            aria-label="¿Cómo funciona el módulo de repartos?"
            title="¿Cómo funciona?"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '18px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </button>
        </div>
      </div>

      {/* 2) TRES FILTROS DE TIEMPO DE ESPERA ARRIBA DEL MAPA (Decisión 3 del dueño) */}
      <BarraFiltros
        role="group"
        aria-label="Filtros por tiempo de espera"
        style={{ padding: '0 4px' }}
      >
        <FiltroCombo
          etiqueta="Espera"
          valor={filtroRetraso}
          valorPorDefecto="todos"
          opciones={[
            { valor: 'todos', etiqueta: 'Todos' },
            { valor: 'retrasado', etiqueta: 'Retrasado (desde 20 min)', cantidad: conteosEspera.retrasados },
            { valor: 'tarde', etiqueta: 'Tarde (desde 30 min)', cantidad: conteosEspera.tardes },
            { valor: 'muy_tarde', etiqueta: 'Muy tarde (desde 45 min)', cantidad: conteosEspera.muyTardes },
          ]}
          alCambiar={(v) => setFiltroRetraso(v as FiltroRetraso)}
        />

        {/* Pastillas de filtro rápido por zona si hay filtro activo */}
        {filtroZona !== 'todas' && (
          <button
            type="button"
            onClick={() => setFiltroZona('todas')}
            style={{
              minHeight: '36px',
              padding: '0 10px',
              borderRadius: '9999px',
              border: '1.5px dashed var(--cp-navy, #0B2C3E)',
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Zona {filtroZona} × (quitar filtro)
          </button>
        )}
      </BarraFiltros>

      {/* Contador visible de pedidos esperando repartidor */}
      <div
        role="status"
        data-testid="contador-cola-espera"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: disponibles.length > 0 ? '#EFF6FF' : 'var(--cp-cream, #FFFDF8)',
          border: '1.5px solid var(--cp-line, #E3D6C6)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 800,
          color: 'var(--cp-navy, #0B2C3E)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: disponibles.length > 0 ? 'var(--cp-orange, #E67929)' : 'var(--cp-green, #2F7A45)',
            }}
          />
          <span>
            {disponibles.length} {disponibles.length === 1 ? 'pedido esperando repartidor' : 'pedidos esperando repartidor'}
          </span>
        </div>
        {disponibles.length > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--cp-soft, #5A6E78)', fontWeight: 600 }}>
            Listos ordenados del más antiguo al más nuevo
          </span>
        )}
      </div>

      {modoVista === 'rutas' ? (
        <RutasAdmin />
      ) : cargando ? (
        <div style={{ padding: '60px 0' }}>
          <Cargando mensaje="Cargando pedidos de reparto..." />
        </div>
      ) : error ? (
        <EstadoError mensaje={error} alReintentar={cargarDatos} />
      ) : modoVista === 'panel' && panel ? (
        <>
          <PanelRepartidores panel={panel} config={config} alAbrir={setPedidoSeleccionadoId} />
          {pedidoSeleccionado && (
            <ResumenPedidoReparto
              pedido={pedidoSeleccionado}
              esMio={false}
              esDisponible={pedidoSeleccionado.estado === 'LISTO' && !pedidoSeleccionado.repartidor_party_id}
              puedeLiquidar={puedeLiquidar}
              alCerrar={() => setPedidoSeleccionadoId(null)}
              alActualizar={cargarDatos}
              acciones={acciones}
            />
          )}
        </>
      ) : modoVista === 'panel' ? (
        <EstadoError mensaje="No se pudo cargar el panel de repartidores." alReintentar={cargarDatos} />
      ) : modoVista === 'mapa' ? (
        /* VISTA MAPA PRINCIPAL (Decisión 2 del dueño) */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            ...(pantallaCompleta ? { flex: '1 1 auto', minHeight: 0, position: 'relative' } : {}),
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'var(--cp-soft, #5A6E78)' }}>
            Pin con anillo: ya lo lleva un repartidor (su nombre sale en la etiqueta). Pin sin anillo: «sin repartidor».
            Color: minutos de espera.
          </p>
          {/* Componente de Mapa Leaflet con Zonas Sombreadas y Marcadores */}
          <MapaRepartos
            puntos={puntosMapa}
            zonas={zonasGeo}
            conteoPorZona={conteosPorZona}
            zonaFiltroActiva={filtroZona !== 'todas' ? filtroZona : undefined}
            seleccionadoId={pedidoSeleccionadoId}
            onSeleccionarPunto={(id) =>
              setPedidoSeleccionadoId((prev) => (prev === id ? null : id))
            }
            rutaPuntos={rutaCoordenadasMapa}
            altura={movil ? 'calc(100vh - 160px)' : 'min(65vh, 600px)'}
            onTocarMapa={handleTocarMapa}
            esPantallaCompleta={pantallaCompleta}
            onAlternarPantallaCompleta={alternarPantallaCompleta}
            rutasSugeridas={rutasSugeridas}
            rutaActivaId={rutaSugeridaActivaId}
            resaltadosIds={idsResaltados}
            onSeleccionarRutaSugerida={handleSeleccionarRutaSugerida}
            mostrarRutasSugeridas={mostrarRutasSugeridas || opcionesServidor.length > 0}
            ocultarListaRutas={!!sugeridas.datos}
            onAlternarMostrarRutasSugeridas={() => setMostrarRutasSugeridas((v) => !v)}
          />

          <div
            style={
              pantallaCompleta
                ? {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    maxHeight: '45vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    zIndex: 1000,
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                  }
                : { display: 'contents' }
            }
          >
          {/* Hoja Inferior del Pedido Seleccionado (Decisión 7 del dueño) */}
          {pedidoSeleccionado && (
            <ResumenPedidoReparto
              pedido={pedidoSeleccionado}
              esMio={esMiPedido(pedidoSeleccionado, usuario?.partyId)}
              esDisponible={
                pedidoSeleccionado.estado === 'LISTO' &&
                !pedidoSeleccionado.repartidor_party_id
              }
              puedeLiquidar={puedeLiquidar}
              alCerrar={() => setPedidoSeleccionadoId(null)}
              alActualizar={cargarDatos}
              acciones={acciones}
            />
          )}

          {/* Panel de Ruta Sugerida e Iniciar Ruta (Decisión 4 del dueño) */}
          {pantallaCompleta && candidatosParaPanel.length > 0 && (
            <button
              type="button"
              onClick={() => setPanelRutaAbierto((v) => !v)}
              aria-expanded={panelRutaAbierto}
              style={{
                minHeight: '48px',
                margin: '0 8px 8px',
                padding: '0 16px',
                borderRadius: '14px',
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                background: 'var(--cp-cream, #FFFDF8)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {panelRutaAbierto ? 'Ocultar ruta sugerida' : `Ruta sugerida (${rutaCalculada.paradas?.length ?? candidatosParaPanel.length})`}
            </button>
          )}
          {puedeTomarRuta && (
            <OpcionesRutaSugerida
              datos={sugeridas.datos}
              cargando={sugeridas.cargando}
              error={sugeridas.error}
              alReintentar={sugeridas.recargar}
              seleccionadaId={rutaSugeridaActivaId}
              alSeleccionar={setRutaSugeridaActivaId}
              alCambiar={() => {
                sugeridas.recargar();
                cargarDatos();
              }}
              repartidorDestinoId={esRolRepartidor ? undefined : destinoAdmin}
              puedeTomar={esRolRepartidor || !!destinoAdmin}
            />
          )}
          {(datosMios.pedidos.length > 0 || !sugeridas.datos) && candidatosParaPanel.length > 0 && (!pantallaCompleta || panelRutaAbierto) && (
            <PanelRutaSugerida
              ruta={rutaCalculada}
              pedidosCandidatos={candidatosParaPanel}
              paradasSeleccionadasIds={paradasRutaIds}
              onAlternarSeleccionParada={handleAlternarSeleccionParada}
              onMoverParada={handleMoverParada}
              config={config}
              maxParadas={config.maxPedidosPorRepartidor}
              alIniciarRuta={handleIniciarRuta}
              avisosPerdidos={avisosPerdidos}
              onCerrarAvisoPerdido={(pedidoId) =>
                setAvisosPerdidos((prev) => prev.filter((p) => p.pedidoId !== pedidoId))
              }
              cargandoInicio={cargandoInicioRuta}
            />
          )}
          </div>
        </div>
      ) : (
        /* VISTA LISTA SECUNDARIA (Doble Vista, Decisión 2) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Filtro por zona para la lista */}
          <BarraFiltros
            role="group"
            aria-label="Filtrar por zona"
          >
            <FiltroCombo
              etiqueta="Zona"
              valor={filtroZona}
              valorPorDefecto="todas"
              opciones={[
                { valor: 'todas', etiqueta: 'Todas las zonas' },
                ...Object.entries(conteosPorZona).map(([z, cant]) => ({ valor: z, etiqueta: z, cantidad: cant })),
              ]}
              alCambiar={setFiltroZona}
            />
          </BarraFiltros>

          {listaPorEspera.length === 0 ? (
            <EstadoVacio
              mensaje={
                pedidosBase.length === 0
                  ? 'No hay pedidos en esta vista.'
                  : 'No hay pedidos para la zona o filtro seleccionado.'
              }
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '14px',
                alignItems: 'start',
              }}
            >
              {listaPorEspera.map((pedido) => (
                <TarjetaReparto
                  key={pedido.id}
                  pedido={pedido}
                  esDisponible={pedido.estado === 'LISTO' && !pedido.repartidor_party_id}
                  esMio={esMiPedido(pedido, usuario?.partyId)}
                  puedeLiquidar={puedeLiquidar}
                  alActualizar={cargarDatos}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal accesible de Ayuda "¿Cómo funciona?" (Decisión 1 del dueño) */}
      {ayudaAbierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-ayuda-repartos"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(11, 44, 62, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAyudaAbierta(false);
          }}
        >
          <div
            style={{
              background: 'var(--cp-white, #FFFFFF)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                id="titulo-ayuda-repartos"
                style={{
                  margin: 0,
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy, #0B2C3E)',
                }}
              >
                ¿Cómo funciona Repartos?
              </h2>
              <button
                type="button"
                aria-label="Cerrar ayuda"
                onClick={() => setAyudaAbierta(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '22px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: 'var(--cp-soft, #5A6E78)',
                }}
              >
                ×
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '14px', lineHeight: '21px', color: 'var(--cp-navy, #0B2C3E)' }}>
              Cada pedido listo aparece disponible en el mapa. El repartidor que lo toma se lo adjudica
              y a los demás les desaparece. Desde su celular navega por Google Maps o Waze con todas las
              paradas ordenadas.
            </p>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--cp-soft, #5A6E78)' }}>
              Los tres colores superiores indican el tiempo de espera desde que se terminó el pedido:
              verde (&lt; 20 min), amarillo (Retrasado desde 20 min), naranja (Tarde desde 30 min) y
              rojo palpitando (Muy tarde desde 45 min).
            </p>

            <button
              type="button"
              onClick={() => setAyudaAbierta(false)}
              style={{
                marginTop: '6px',
                minHeight: '44px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--cp-navy, #0B2C3E)',
                color: 'var(--cp-cream, #FFFDF8)',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
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

export function RepartosView() {
  const { tiene, usuario } = useSesion();
  const puedeVer = tiene('repartos/ver');
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

  return <RepartosAdminView />;
}
