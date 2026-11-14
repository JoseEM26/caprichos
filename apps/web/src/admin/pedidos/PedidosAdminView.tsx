import { useCuadricula } from './paginacionCaja';
import { PaginadorCaja, TOPE_TODAS, normalizarFilas, tamanoPagina, type FilasPorPagina } from './PaginadorCaja';
import { TablaCaja } from './TablaCaja';
import { ConmutadorVista, FiltroMedios, SelectorColumnas, VISTAS_CAJA, normalizarVistaCaja, type VistaCaja } from './ControlesTabla';
import { ListaCaja } from './ListaCaja';
import { COLUMNAS_POR_DEFECTO, normalizarColumnas } from './columnasCaja';
import { MEDIOS_FILTRO, enMedios } from './mediosFila';
import { CLAVE_COLUMNAS, CLAVE_FILAS, CLAVE_VISTA, usePreferenciaCaja } from './preferenciasCaja';
import { DetalleVentaModal } from './DetalleVentaModal';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { pedidosApi, Pedido, RespuestaNoEntregados, type DatosEdicionPedido } from './pedidosApi';
import { PedidoDetalle } from './PedidoDetalle';
import { BandejaPropuestasUbicacion } from './BandejaPropuestasUbicacion';
import { PanelCambioCobro, useCambiosCobroPendientes } from './PanelCambioCobro';
import { PanelNoEntregados } from './PanelNoEntregados';
import { PanelProgramados } from './PanelProgramados';
import { coincideTexto } from '../../comun/normalizarBusqueda';
import { useSesion } from '../../comun/sesion';
import { tieneRolUsuario } from '../../comun/rolesUsuario';
import { ModalNuevoPedidoMesa } from '../salon/componentes/ModalNuevoPedidoMesa';
import { AccesoListaEsperaCaja } from '../salon/componentes/AccesoListaEsperaCaja';
import { RegistrarCortesiaModal } from '../cortesias/RegistrarCortesiaModal';
import { salonApi } from '../salon/api';
import type { PisoSalon } from '../salon/tipos';
import { reproducirCampana } from './audioAlerta';
import { FranjaImpresion } from './FranjaImpresion';
import { BannerCajaCerrada, esperaCajaCerrada, useEstadoCajaHoy } from './BannerCajaCerrada';
import './pedidos.css';
import './caja-lista.css';
import { FiltroDiasPedidos } from './FiltroDiasPedidos';
import { RangoPedidos, hoyLima, parametrosDeRango, rangoHoy, textoRango } from './filtroDias';

/** ¿El pedido nuevo cae dentro del día o rango que se ve? (los de «pendientes» son de días anteriores: uno recién creado no entra) */
export function enRangoVisible(creadoEn: string, r: RangoPedidos): boolean {
  if (r.modo === 'pendientes') return false;
  const dia = hoyLima(new Date(creadoEn));
  const rr = r.modo === 'hoy' ? rangoHoy() : r;
  return dia >= rr.desde && dia <= rr.hasta;
}
import { nombreMedio } from './planPago';
import { ORDEN_POR_DEFECTO, OrdenTiempo, TEXTO_ORDEN, ordenInicial, ordenarPorTiempo, recordarOrden } from './ordenCaja';
import { ContadorDia, enContador, filasDePedidos, resumirDia, type ResumenDia } from './resumenDia';
import { TarjetaPedidoCaja } from './TarjetaPedidoCaja';
import { TarjetaCuentaCaja } from './TarjetaCuentaCaja';
import { agruparCuentas } from './agruparCuentas';
import { VentanaDetalle } from './VentanaDetalle';
import { useAccionesCaja } from './accionesCaja';
import {
  EtapaCaja,
  FILTROS_CAJA,
  FiltroCaja,
  enEtapaCaja,
  enFiltroCaja,
  esCerrado,
  esPorConfirmar,
} from './estadosCaja';

export { getBadge } from './estadosCaja';

export function canalLabel(c?: string | null) {
  if (!c) return 'Web';
  const cu = c.toUpperCase();
  if (cu === 'CARTA') return 'Web';
  if (cu === 'BOT' || cu === 'WHATSAPP') return 'WhatsApp';
  if (cu === 'MOZO') return 'Mozo';
  if (cu === 'CAJA') return 'Caja';
  return c;
}

export function modLabel(m?: string | null) {
  if (!m) return 'Local';
  const mu = m.toUpperCase();
  if (mu === 'DELIVERY') return 'Delivery';
  if (mu === 'LLEVAR' || mu === 'RECOGER') return 'Para llevar';
  if (mu === 'MESA') return 'En mesa';
  if (mu === 'COMER_LOCAL') return 'Comer en el local';
  return m;
}

/** Chip «Cobrado por mozo · Yape»; en naranja y «falta captura (opcional)» si el medio digital no tiene foto legible. */
export function ChipCobroMozo({ cobro }: { cobro?: Pedido['cobroMozo'] }) {
  if (!cobro) return null;
  const alerta = cobro.faltaVoucher;
  if (cobro.sinCaptura) {
    return (
      <span
        data-testid="insignia-sin-captura"
        style={{
          alignSelf: 'flex-start',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 9999,
          padding: '2px 10px',
          background: '#FFF4D6',
          color: '#8A5A00',
          border: '1.5px solid #E0A526',
        }}
      >
        Pagado sin captura · confirmó {cobro.mozo || 'el mozo'} · {cobro.medio.split('+').map(nombreMedio).join(' + ')}
      </span>
    );
  }
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 9999,
        padding: '2px 10px',
        background: alerta ? '#FFF0E6' : 'var(--cp-sand, #EDE1D1)',
        color: alerta ? 'var(--cp-rust, #B2500F)' : 'var(--cp-navy, #0B2C3E)',
        border: alerta ? '1.5px solid var(--cp-rust, #B2500F)' : '1.5px solid transparent',
      }}
    >
      Cobrado por mozo · {cobro.medio.split('+').map(nombreMedio).join(' + ')}
      {cobro.pide && <> · pide {cobro.pide === 'FACTURA' ? 'Factura' : 'Boleta'}</>}
      {alerta && <strong> · falta captura (opcional)</strong>}
    </span>
  );
}

/** Grupo «Estado» del panel de Filtros: activos (por defecto), cerrados o los delivery no entregados. */
export type GrupoEstadoCaja = 'act' | 'cer' | 'todos' | 'noent' | 'prog';

/** Enlaces viejos: ?estado=todos o ?vista=todo abren la lista viendo todo (activos y cerrados). */
function grupoInicialDeUrl(): GrupoEstadoCaja {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('estado') === 'todos' || q.get('vista') === 'todo' ? 'todos' : 'act';
  } catch {
    return 'act';
  }
}

const CLAVE_RESUMEN = 'caprichos.caja.resumen';
const SUBTITULO_CAJA = 'El cajero verifica cada pedido y lo acepta antes de que pase a cocina.';
const soles = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pedidos por página del API (máximo permitido); «Cargar más» pide la siguiente. */
const LIMITE_PAGINA = 100;
/** Con filtro o búsqueda se piden solas hasta estas páginas (2000 pedidos); más allá se avisa. */
const MAX_PAGINAS_AUTOMATICAS = 20;

/** Hoy y «pendientes de días anteriores» muestran lo activo; otro día o rango muestra todo (lo de ayer casi siempre ya está cerrado). */
function estadoPorDefectoDeRango(r: RangoPedidos): GrupoEstadoCaja {
  return r.modo === 'hoy' || r.modo === 'pendientes' ? 'act' : 'todos';
}

const ESTADO_OPCIONES = [
  { id: 'act', n: 'Activos' },
  { id: 'cer', n: 'Cerrados' },
  { id: 'todos', n: 'Todos (activos y cerrados)' },
  { id: 'noent', n: 'No entregados' },
  { id: 'prog', n: 'Programados' },
];

const ETAPA_OPCIONES = [
  { id: 'all', n: 'Todas' },
  { id: 'confirmar', n: 'Por confirmar' },
  { id: 'cola', n: 'Sin empezar' },
  { id: 'coord', n: 'Pago por coordinar' },
];

const CANALES_OPCIONES = [
  { id: 'all', n: 'Todos' },
  { id: 'CARTA', n: 'Web' },
  { id: 'BOT', n: 'WhatsApp' },
  { id: 'MOZO', n: 'Mozo' },
  { id: 'CAJA', n: 'Caja' },
];

const MODALIDADES_OPCIONES = [
  { id: 'all', n: 'Todas' },
  { id: 'DELIVERY', n: 'Delivery' },
  { id: 'LLEVAR', n: 'Para llevar' },
  { id: 'MESA', n: 'En mesa' },
  { id: 'COMER_LOCAL', n: 'Comer en el local' },
];

const COBRO_OPCIONES = [
  { id: 'all', n: 'Todos' },
  { id: 'paid', n: 'Cobrado' },
  { id: 'unpaid', n: 'Pendiente' },
  { id: 'sincaptura', n: 'Sin captura' },
];

/** Conteo ligero de pendientes de días anteriores; si falla no tumba la carga de la lista. */
async function contarPendientesAnteriores(): Promise<number | null> {
  try {
    const r = await pedidosApi.listar({ pendientes: true, limite: 1 });
    return r.total;
  } catch {
    return null;
  }
}

const TEXTO_CONTADOR: Record<ContadorDia, string> = {
  entregados: 'Solo entregados',
  anulados: 'Solo anulados',
  rechazados: 'Solo rechazados',
  porcobrar: 'Solo por cobrar',
};

/** Une pedidos nuevos a los que ya están, sin repetir ninguno. */
function unirSinRepetir(actuales: Pedido[], nuevos: Pedido[]): Pedido[] {
  const vistos = new Set(actuales.map((p) => String(p.id)));
  const extra = nuevos.filter((p) => !vistos.has(String(p.id)) && vistos.add(String(p.id)));
  return [...actuales, ...extra];
}

export function PedidosAdminView() {
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string>('');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  // Originales/extras de una cuenta que la página cargada no trajo (solo para armar la tarjeta; no entran en contadores ni resumen)
  const [relacionados, setRelacionados] = useState<Pedido[]>([]);
  // Día o rango que muestra la lista (por defecto hoy en Lima; no se recuerda entre visitas)
  const [rango, setRango] = useState<RangoPedidos>(() => rangoHoy());
  // Paginación del servidor: páginas de 100 ya cargadas, cuántos pedidos tiene el filtro y el conteo agrupado
  const paginasRef = useRef<number>(1);
  const [totalDia, setTotalDia] = useState<number>(0);
  const [resumenApi, setResumenApi] = useState<NonNullable<Awaited<ReturnType<typeof pedidosApi.listar>>['resumen']> | null>(null);
  const [cargandoMas, setCargandoMas] = useState<boolean>(false);
  const [errorMas, setErrorMas] = useState<string>('');
  // Pedido abierto por ?pedido= que no está en la lista cargada (otro día, o más allá de lo cargado)
  const [pedidoExterno, setPedidoExterno] = useState<Pedido | null>(null);
  const [pendientesAnteriores, setPendientesAnteriores] = useState<number>(0);
  const [nuevoPedidoAbierto, setNuevoPedidoAbierto] = useState(false);
  const [cortesiaSeparadaAbierta, setCortesiaSeparadaAbierta] = useState(false);
  const [pedidoRepetir, setPedidoRepetir] = useState<Pedido | null>(null);
  // Editar pedido: datos que trae el servidor (con su versión) y el aviso si no se puede abrir
  const [edicionPedido, setEdicionPedido] = useState<DatosEdicionPedido | null>(null);
  const [errorEditar, setErrorEditar] = useState<string | null>(null);
  // Agregar extra: pedido original sobre el que se abre el modal en modo «extra»
  const [pedidoExtra, setPedidoExtra] = useState<Pedido | null>(null);
  const abrirEditor = async (p: Pedido) => {
    setErrorEditar(null);
    try {
      setEdicionPedido(await pedidosApi.obtenerParaEditar(p.id));
    } catch (err: any) {
      setErrorEditar(err?.message || 'No se pudo abrir el pedido para editarlo.');
    }
  };
  const [pisosSalon, setPisosSalon] = useState<PisoSalon[]>([]);
  // Pedido abierto en la ventana de detalle (null = cerrada)
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Los cuatro filtros visibles y el grupo «Estado» del panel de Filtros
  const [filtro, setFiltro] = useState<FiltroCaja>('todo');
  const [grupoEstado, setGrupoEstado] = useState<GrupoEstadoCaja>(grupoInicialDeUrl);
  // Contador del resumen del día que filtra por un estado exacto (entregados, anulados, rechazados, por cobrar)
  const [contador, setContador] = useState<ContadorDia | null>(null);
  const [etapa, setEtapa] = useState<EtapaCaja>('all');

  const [busqueda, setBusqueda] = useState<string>('');
  const [fcOpen, setFcOpen] = useState<boolean>(false);
  const [infoAbierta, setInfoAbierta] = useState<boolean>(false);
  // Resumen del día: visible compacto por defecto; si se pliega, se recuerda en este equipo
  const [resumenAbierto, setResumenAbierto] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CLAVE_RESUMEN) !== 'plegado';
    } catch {
      return true;
    }
  });
  const alternarResumen = () => {
    const nuevo = !resumenAbierto;
    setResumenAbierto(nuevo);
    try {
      window.localStorage.setItem(CLAVE_RESUMEN, nuevo ? 'abierto' : 'plegado');
    } catch {
      // sin almacenamiento: solo vale en esta sesión
    }
  };
  const panelRef = useRef<HTMLDivElement>(null);
  const botonFiltrosRef = useRef<HTMLButtonElement>(null);
  const [masAbierto, setMasAbierto] = useState<boolean>(false);
  const [canalFiltro, setCanalFiltro] = useState<string>('all');
  const [modalidadFiltro, setModalidadFiltro] = useState<string>('all');
  const [cobroFiltro, setCobroFiltro] = useState<string>('all');
  const [mediosFiltro, setMediosFiltro] = useState<string[]>([]);
  // Vista (tarjetas o tabla), columnas de la tabla y filas por página: se guardan por usuario
  const [vista, setVista] = usePreferenciaCaja<VistaCaja>(CLAVE_VISTA, 'tarjetas', normalizarVistaCaja);
  // Lista: usa los mismos filtros y el mismo orden por tiempo que Tarjetas y Tabla
  const enLista = vista === 'lista';
  const [columnasTabla, setColumnasTabla] = usePreferenciaCaja<string[]>(CLAVE_COLUMNAS, COLUMNAS_POR_DEFECTO, normalizarColumnas);
  const [filas, setFilas] = usePreferenciaCaja<FilasPorPagina>(CLAVE_FILAS, null, normalizarFilas);
  const [detalleVentaId, setDetalleVentaId] = useState<string | null>(null);
  // Cada carga lleva su número: una respuesta tardía de un día o filtro anterior se descarta
  const generacion = useRef(0);
  // Sentido por tiempo: «Limpiar filtros» no lo borra (es preferencia de vista; se quita con su propio chip)
  const [orden, setOrdenState] = useState<OrdenTiempo>(() => ordenInicial());
  const cambiarOrden = (o: OrdenTiempo) => {
    setOrdenState(o);
    recordarOrden(o);
    setPaginaActual(1);
  };

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const { columnas, porPagina: pedidosPorPagina } = useCuadricula();

  // Alerta sonora y visual
  const [pedidosResaltados, setPedidosResaltados] = useState<Set<string>>(new Set());

  // Delivery no entregados (con su contador)
  const { tiene, usuario } = useSesion();
  const puedeValidarCobro = tiene('pedidos/validar_cambio_cobro');
  const cambiosCobro = useCambiosCobroPendientes(puedeValidarCobro);
  const puedeLiquidar = tiene('repartos/liquidar');
  const { abierta: cajaAbierta } = useEstadoCajaHoy();
  const [noEntregados, setNoEntregados] = useState<RespuestaNoEntregados | null>(null);
  const [cargandoNoEntregados, setCargandoNoEntregados] = useState<boolean>(false);
  const [errorNoEntregados, setErrorNoEntregados] = useState<string>('');

  const cargarNoEntregados = useCallback(async () => {
    setCargandoNoEntregados(true);
    try {
      const datos = await pedidosApi.listarNoEntregados();
      setNoEntregados(datos);
      setErrorNoEntregados('');
    } catch (err: any) {
      setErrorNoEntregados(err?.message || 'No se pudieron cargar los pedidos no entregados');
    } finally {
      setCargandoNoEntregados(false);
    }
  }, []);

  // Carga inicial y refresco (se vuelve a cargar al cambiar el día o rango)
  const cargarDatos = useCallback(async () => {
    setErrorCarga('');
    const g = ++generacion.current;
    // «Hoy» se recalcula en cada carga: con la pantalla abierta pasada la medianoche (Lima) no se queda en el día anterior
    const rangoActual = rango.modo === 'hoy' ? rangoHoy() : rango;
    try {
      // Se vuelven a leer todas las páginas ya cargadas, para que un refresco no recorte lo que ya se ve
      const [paginas, pendientes] = await Promise.all([
        Promise.all(
          Array.from({ length: Math.max(1, paginasRef.current) }, (_, i) =>
            pedidosApi.listar({ ...parametrosDeRango(rangoActual), ...(mediosFiltro.length ? { medios: mediosFiltro } : {}), limite: LIMITE_PAGINA, ...(i === 0 ? { resumen: true } : { pagina: i + 1 }) }),
          ),
        ),
        contarPendientesAnteriores(),
      ]);
      if (g !== generacion.current) return;
      setPedidos(unirSinRepetir([], paginas.flatMap((r) => r.items || [])));
      setRelacionados(unirSinRepetir([], paginas.flatMap((r) => r.relacionados || [])));
      setTotalDia(paginas[0].total ?? 0);
      setResumenApi(paginas[0].resumen ?? null);
      if (pendientes !== null) setPendientesAnteriores(pendientes);
    } catch (err: any) {
      if (g === generacion.current) setErrorCarga(err?.message || 'Error al cargar los pedidos');
    } finally {
      if (g === generacion.current) setCargando(false);
    }
  }, [rango, mediosFiltro.join('|')]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // En vivo: un evento (pedido nuevo, estado, cobro, edición) relee la lista Y el resumen agrupado del servidor, con antirrebote de 1 s.
  // cargarDatos descarta toda respuesta anterior a la última (generacion), así una respuesta vieja no pisa una más nueva.
  const cargarRef = useRef(cargarDatos);
  cargarRef.current = cargarDatos;
  const temporizadorVivo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refrescarEnVivo = useCallback(() => {
    if (temporizadorVivo.current) clearTimeout(temporizadorVivo.current);
    temporizadorVivo.current = setTimeout(() => void cargarRef.current(), 1000);
  }, []);
  useEffect(() => () => { if (temporizadorVivo.current) clearTimeout(temporizadorVivo.current); }, []);

  useEffect(() => {
    void cargarNoEntregados();
  }, [cargarNoEntregados]);

  // «Cargar más»: pide la página siguiente y la une a la lista sin repetir los que ya llegaron (por socket o por un corrimiento)
  const cargarMas = async () => {
    const siguiente = paginasRef.current + 1;
    const g = generacion.current;
    setCargandoMas(true);
    setErrorMas('');
    try {
      const r = await pedidosApi.listar({ ...parametrosDeRango(rango.modo === 'hoy' ? rangoHoy() : rango), ...(mediosFiltro.length ? { medios: mediosFiltro } : {}), limite: LIMITE_PAGINA, pagina: siguiente });
      // Cambió el día o un filtro de servidor mientras llegaba: esta página ya no sirve
      if (g !== generacion.current) return;
      paginasRef.current = siguiente;
      setTotalDia(r.total ?? 0);
      setPedidos((prev) => unirSinRepetir(prev, r.items || []));
      setRelacionados((prev) => unirSinRepetir(prev, r.relacionados || []));
    } catch (err: any) {
      if (g === generacion.current) setErrorMas(err?.message || 'No se pudieron cargar más pedidos');
    } finally {
      setCargandoMas(false);
    }
  };

  // Con filtro o búsqueda activos hay que mirar TODO el rango (si no, un pedido sin cargar no aparece ni se cuenta).
  // Se piden las páginas que faltan una tras otra; hay tope por seguridad y, si no se puede completar, se avisa.
  const filtrando =
    busqueda.trim() !== '' || contador !== null || etapa !== 'all' || canalFiltro !== 'all' ||
    modalidadFiltro !== 'all' || cobroFiltro !== 'all' || mediosFiltro.length > 0 || filtro !== 'todo' || grupoEstado !== estadoPorDefectoDeRango(rango);
  // La tabla y «Todas» necesitan toda la lista del filtro (para cuadrar), no solo la primera página
  const necesitaTodo = filtrando || vista === 'tabla' || enLista || filas === 'todas';
  const faltanPorCargar = pedidos.length < totalDia;
  useEffect(() => {
    if (!necesitaTodo || !faltanPorCargar || cargando || cargandoMas || errorMas) return;
    if (paginasRef.current >= MAX_PAGINAS_AUTOMATICAS) return;
    void cargarMas();
    // cargarMas solo usa refs y setters estables y el rango, que ya dispara la recarga
     
  }, [necesitaTodo, faltanPorCargar, cargando, cargandoMas, errorMas, pedidos.length]);

  const cambiarRango = (nuevo: RangoPedidos) => {
    paginasRef.current = 1;
    generacion.current++;
    setErrorMas('');
    setRango(nuevo);
    setPaginaActual(1);
    // Ayer o un rango anterior: casi todo está entregado, así que se ve TODO (activos y cerrados); hoy y «pendientes» siguen con activos
    setGrupoEstado(estadoPorDefectoDeRango(nuevo));
  };

  // El medio de pago también se pide al servidor: se vuelve a cargar desde la primera página
  const cambiarMedios = (m: string[]) => {
    paginasRef.current = 1;
    generacion.current++;
    setErrorMas('');
    setMediosFiltro(m);
    setPaginaActual(1);
  };

  const cambiarGrupoEstado = (g: GrupoEstadoCaja) => {
    setGrupoEstado(g);
    setPaginaActual(1);
    if (g === 'noent') void cargarNoEntregados();
  };

  // Enlace de la campana (/admin/caja?pedido=ID): abre ese pedido en su ventana, una sola vez
  const deepLinkResuelto = useRef(false);
  useEffect(() => {
    if (cargando || deepLinkResuelto.current) return;
    deepLinkResuelto.current = true;
    const idUrl = new URLSearchParams(window.location.search).get('pedido');
    if (!idUrl) return;
    const pedidoUrl = pedidos.find((p) => String(p.id) === idUrl);
    if (!pedidoUrl) {
      // No depende del filtro ni del día: se lee el pedido y se abre aunque esté anulado o entregado
      pedidosApi.obtenerPorId(idUrl).then((p) => {
        setPedidoExterno(p);
        setPedidoSeleccionadoId(String(p.id));
      }).catch(() => {});
      return;
    }
    // Un pedido cerrado vive en el grupo Cerrados; lo demás se ve en «Todo» (activos)
    if (esCerrado(pedidoUrl)) setGrupoEstado((g) => (g === 'act' ? 'cer' : g));
    setPedidoSeleccionadoId(String(pedidoUrl.id));
    // El enlace se resuelve una sola vez (deepLinkResuelto), aunque cambien las dependencias
  }, [cargando, pedidos]);

  // Socket events
  useEventos('pedido:nuevo', (datos: { id: string | number; codigo?: string }) => {
    const idStr = String(datos.id);
    reproducirCampana();
    setPedidosResaltados((prev) => new Set(prev).add(idStr));
    setTimeout(() => {
      setPedidosResaltados((prev) => {
        const next = new Set(prev);
        next.delete(idStr);
        return next;
      });
    }, 6000);

    pedidosApi.obtenerPorId(idStr).then((nuevoPedido) => {
      setPedidos((prev) => {
        if (prev.some((p) => String(p.id) === idStr)) {
          return prev.map((p) => (String(p.id) === idStr ? nuevoPedido : p));
        }
        // Viendo ayer o un rango pasado, un pedido de hoy no pertenece a la lista
        if (!enRangoVisible(nuevoPedido.creado_en, rango)) return prev;
        return [nuevoPedido, ...prev];
      });
    }).catch(() => {
      cargarDatos();
    });
    refrescarEnVivo();
  });

  // Retiro por espera agotada o cambio de estado: refresca la pestaña No entregados
  useEventos('reparto:incidente', () => {
    void cargarNoEntregados();
  });

  // Otra terminal agregó un extra: la lista del original (extras y total con extras) se vuelve a leer
  useEventos('pedido:extra', () => void cargarDatos());

  useEventos('pedido:estado', (datos: { id: string | number; estado?: string }) => {
    const idStr = String(datos.id);
    void cargarNoEntregados();
    setPedidos((prev) =>
      prev.map((p) => (String(p.id) === idStr && datos.estado ? { ...p, estado: datos.estado } : p)),
    );
    pedidosApi.obtenerPorId(idStr).then((pActualizado) => {
      setPedidos((prev) => prev.map((p) => (String(p.id) === idStr ? pActualizado : p)));
    }).catch(() => {});
    refrescarEnVivo();
  });

  // «Ana está editando este pedido»: llega por socket y vale 2 minutos si no se repite; se libera al guardar o cerrar
  const [editando, setEditando] = useState<Record<string, { nombre: string; hasta: number }>>({});
  useEventos('pedido:editando', (d: { id: string | number; activo: boolean; partyId?: string; nombre?: string }) => {
    const idStr = String(d.id);
    setEditando((prev) => {
      const { [idStr]: _quitar, ...resto } = prev;
      if (!d.activo || String(d.partyId) === String(usuario?.partyId)) return resto;
      return { ...resto, [idStr]: { nombre: d.nombre || 'Alguien', hasta: Date.now() + 2 * 60 * 1000 } };
    });
  });
  useEffect(() => {
    const proximo = Object.values(editando).reduce((m, e) => Math.min(m, e.hasta), Infinity);
    if (proximo === Infinity) return;
    const t = setTimeout(() => setEditando((prev) => Object.fromEntries(Object.entries(prev).filter(([, e]) => e.hasta > Date.now()))), Math.max(0, proximo - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [editando]);

  // Alguien editó un pedido (productos, datos o total): se vuelve a leer completo, igual que con el cambio de estado
  useEventos('pedido:editado', (datos: { id: string | number }) => {
    const idStr = String(datos.id);
    setEditando((prev) => {
      const { [idStr]: _quitar, ...resto } = prev;
      return resto;
    });
    pedidosApi.obtenerPorId(idStr).then((pa) => {
      setPedidos((prev) => prev.map((p) => (String(p.id) === idStr ? pa : p)));
    }).catch(() => {});
    refrescarEnVivo();
  });

  useEventos('pedido:pago', (datos: { id: string | number; pago_estado?: string }) => {
    const idStr = String(datos.id);
    setPedidos((prev) =>
      prev.map((p) => (String(p.id) === idStr ? { ...p, pago_estado: datos.pago_estado ?? 'PAGADO' } : p)),
    );
    // cobrado, coordinado o anulado: se vuelve a leer el pedido completo (el modal abierto lo toma de la lista)
    pedidosApi.obtenerPorId(idStr).then((pa) => {
      setPedidos((prev) => prev.map((p) => (String(p.id) === idStr ? pa : p)));
    }).catch(() => {});
    // el cobro ya relee todo por useTiempoReal (abajo)
  });

  // Tiempo real de Caja: voucher/plan, cobros, cierre y respaldo (reconexión, volver a la pestaña, sondeo sin socket).
  // Recarga en silencio: no toca la ventana abierta ni el scroll.
  useTiempoReal(
    ['vouchers:actualizado', 'pedido:pago', 'caja:cerrada', 'comprobante:cambio', 'reparto:incidente'],
    () => {
      void cargarDatos();
      void cargarNoEntregados();
    },
  );

  // Botón grande de cada tarjeta: mismas acciones, modales y endpoints que el detalle
  const abrirDetalle = (p: Pedido) => setPedidoSeleccionadoId(String(p.id));
  const { accionDe, ejecutar: ejecutarAccion, dialogos: dialogosAcciones } = useAccionesCaja({
    alActualizar: cargarDatos,
    abrirDetalle,
  });

  // Todo lo que filtra salvo las pastillas: estado (activos/cerrados), etapa, canal, modalidad, cobro y búsqueda
  const base = useMemo(() => {
    const q = busqueda.trim();
    return pedidos.filter((p) => {
      if (grupoEstado === 'cer' ? !esCerrado(p) : grupoEstado === 'act' && esCerrado(p)) return false;
      if (contador && !enContador(p, contador)) return false;
      if (!enEtapaCaja(p, etapa)) return false;

      if (canalFiltro !== 'all') {
        const cu = String(p.canal).toUpperCase();
        if (canalFiltro === 'BOT' || canalFiltro === 'WHATSAPP') {
          if (cu !== 'BOT' && cu !== 'WHATSAPP') return false;
        } else if (cu !== canalFiltro) {
          return false;
        }
      }
      if (modalidadFiltro !== 'all') {
        const modP = String(p.modalidad).toUpperCase();
        if (modalidadFiltro === 'LLEVAR') {
          if (modP !== 'LLEVAR' && modP !== 'RECOGER') return false;
        } else if (modP !== modalidadFiltro) {
          return false;
        }
      }
      if (!enMedios(p, mediosFiltro)) return false;
      if (cobroFiltro !== 'all') {
        const pag = String(p.pago_estado).toUpperCase() === 'PAGADO';
        if (cobroFiltro === 'paid' && !pag) return false;
        if (cobroFiltro === 'unpaid' && pag) return false;
        if (cobroFiltro === 'sincaptura' && !p.cobroMozo?.sinCaptura) return false;
      }

      if (q) {
        // Por celular: se comparan solo dígitos (con o sin +51, espacios o guiones)
        const qDig = q.replace(/\D/g, '');
        const tel = String(p.cliente_telefono || '').replace(/\D/g, '');
        const porCelular = qDig.length >= 3 && tel.includes(qDig.replace(/^51(?=9\d{8}$)/, ''));
        if (!coincideTexto(q, p.codigo, p.cliente_nombre, p.mesa_nombre) && !porCelular) return false;
      }

      return true;
    });
  }, [pedidos, grupoEstado, contador, etapa, canalFiltro, modalidadFiltro, cobroFiltro, mediosFiltro, busqueda]);

  const conteos = useMemo(() => {
    const r = {} as Record<FiltroCaja, number>;
    for (const f of FILTROS_CAJA) r[f.id] = base.filter((p) => enFiltroCaja(p, f.id)).length;
    return r;
  }, [base]);

  // Primero se ordena y luego se reparte por páginas/columnas
  const pedidosFiltrados = useMemo(
    () => ordenarPorTiempo(base.filter((p) => enFiltroCaja(p, filtro)), orden),
    [base, filtro, orden],
  );

  // Tarjetas: cada «cuenta» (original + extras) es UNA tarjeta; un pedido sin extras es una tarjeta como siempre.
  // La paginación y el «N de M» cuentan tarjetas; los contadores y el resumen siguen contando pedidos.
  const cuentas = useMemo(
    () => agruparCuentas(pedidosFiltrados, [...pedidos, ...relacionados], (p) => String(p.pedido_origen?.id ?? p.id)),
    [pedidosFiltrados, pedidos, relacionados],
  );

  // Atajos: lo que necesita atención no queda escondido
  const porConfirmar = useMemo(() => pedidos.filter(esPorConfirmar).length, [pedidos]);

  // Filtros activos del panel (chips removibles arriba)
  const hoy = hoyLima();
  const chips = useMemo(() => {
    const lista: { id: string; texto: string; quitar: () => void }[] = [];
    const estadoPorDefecto = estadoPorDefectoDeRango(rango);
    if (grupoEstado !== estadoPorDefecto) lista.push({ id: 'estado', texto: ESTADO_OPCIONES.find((e) => e.id === grupoEstado)!.n, quitar: () => cambiarGrupoEstado(estadoPorDefecto) });
    if (filtro !== 'todo') lista.push({ id: 'pastilla', texto: FILTROS_CAJA.find((f) => f.id === filtro)!.n, quitar: () => { setFiltro('todo'); setPaginaActual(1); } });
    if (contador) lista.push({ id: 'contador', texto: TEXTO_CONTADOR[contador], quitar: () => { setContador(null); setPaginaActual(1); } });
    if (etapa !== 'all') lista.push({ id: 'etapa', texto: ETAPA_OPCIONES.find((e) => e.id === etapa)!.n, quitar: () => { setEtapa('all'); setPaginaActual(1); } });
    if (rango.modo !== 'hoy') lista.push({ id: 'dia', texto: textoRango(rango, hoy), quitar: () => cambiarRango(rangoHoy(hoy)) });
    if (canalFiltro !== 'all') lista.push({ id: 'canal', texto: `Canal: ${CANALES_OPCIONES.find((c) => c.id === canalFiltro)?.n}`, quitar: () => { setCanalFiltro('all'); setPaginaActual(1); } });
    if (modalidadFiltro !== 'all') lista.push({ id: 'mod', texto: `Modalidad: ${MODALIDADES_OPCIONES.find((m) => m.id === modalidadFiltro)?.n}`, quitar: () => { setModalidadFiltro('all'); setPaginaActual(1); } });
    if (cobroFiltro !== 'all') lista.push({ id: 'cobro', texto: `Cobro: ${COBRO_OPCIONES.find((c) => c.id === cobroFiltro)?.n}`, quitar: () => { setCobroFiltro('all'); setPaginaActual(1); } });
    if (mediosFiltro.length > 0) lista.push({ id: 'medios', texto: `Medio: ${MEDIOS_FILTRO.filter((m) => mediosFiltro.includes(m.id)).map((m) => m.n).join(', ')}`, quitar: () => { cambiarMedios([]); setPaginaActual(1); } });
    return lista;
    // quitar usa solo setters estables; cambiarGrupoEstado/cambiarRango se recrean pero hacen lo mismo
     
  }, [filtro, grupoEstado, contador, etapa, rango, canalFiltro, modalidadFiltro, cobroFiltro, mediosFiltro, hoy]);

  const nActivos = chips.length;
  const limpiarFiltros = () => {
    setGrupoEstado('act');
    setContador(null);
    setEtapa('all');
    setCanalFiltro('all');
    setModalidadFiltro('all');
    setCobroFiltro('all');
    cambiarMedios([]);
    setBusqueda('');
    setFiltro('todo');
    setPaginaActual(1);
    cambiarRango(rangoHoy(hoy));
  };

  // «Todo el día»: todos los pedidos del día elegido, sin excluir ninguno (activos, pagados, por cobrar, entregados, anulados y rechazados).
  // Quita estado, etapa, canal, modalidad, cobro, pastilla y búsqueda; el día lo decide el chip del rango (hoy; «pendientes» vuelve a hoy).
  const verTodoElDia = () => {
    if (rango.modo === 'pendientes') cambiarRango(rangoHoy(hoy));
    setGrupoEstado('todos');
    setContador(null);
    setEtapa('all');
    setCanalFiltro('all');
    setModalidadFiltro('all');
    setCobroFiltro('all');
    cambiarMedios([]);
    setBusqueda('');
    setFiltro('todo');
    setPaginaActual(1);
    setFcOpen(false);
  };
  const vistaTodo =
    grupoEstado === 'todos' && !contador && etapa === 'all' && canalFiltro === 'all' && modalidadFiltro === 'all' &&
    cobroFiltro === 'all' && mediosFiltro.length === 0 && filtro === 'todo' && !busqueda.trim() && rango.modo !== 'pendientes';

  // El chip aparece en hoy; en ayer o un rango «todo» ya es lo normal y lo dice el chip del rango
  const chipTodo = vistaTodo && rango.modo === 'hoy';

  // Contador del resumen: Activos vuelve a la vista normal; los demás miran todos los estados y se quedan con ese; tocarlo otra vez lo quita
  const elegirContador = (c: ContadorDia | 'activos') => {
    setPaginaActual(1);
    setFiltro('todo');
    if (c === 'activos') { setContador(null); setGrupoEstado('act'); return; }
    if (contador === c) { setContador(null); setGrupoEstado(estadoPorDefectoDeRango(rango)); return; }
    setContador(c);
    setGrupoEstado('todos');
  };

  // Resumen: con toda la lista cargada se cuenta lo que se ve (en vivo con el socket); si faltan páginas, el conteo agrupado del servidor
  const resumen = useMemo(
    () => (resumenApi && pedidos.length < totalDia ? resumirDia(resumenApi) : resumirDia(filasDePedidos(pedidos))),
    [pedidos, totalDia, resumenApi],
  );
  // Los montos siguen lo que se ve: con algún filtro (contador, estado, canal, medio, búsqueda, pastilla) suman SOLO esos pedidos
  const filtrado = pedidosFiltrados.length !== pedidos.length;
  const montos: ResumenDia = useMemo(
    () => (filtrado ? resumirDia(filasDePedidos(pedidosFiltrados)) : resumen),
    [filtrado, pedidosFiltrados, resumen],
  );

  // Cerrar el panel de Filtros y el menú «Más» con un clic fuera o Escape
  const filaFiltrosRef = useRef<HTMLDivElement>(null);
  const masRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fcOpen && !masAbierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (fcOpen && filaFiltrosRef.current && !filaFiltrosRef.current.contains(t)) setFcOpen(false);
      if (masAbierto && masRef.current && !masRef.current.contains(t)) setMasAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFcOpen(false);
        setMasAbierto(false);
      }
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [fcOpen, masAbierto]);

  // Foco accesible: al abrir el panel entra el foco; al cerrarlo vuelve al botón «Filtros»
  const panelYaAbierto = useRef(false);
  useEffect(() => {
    if (fcOpen) {
      panelRef.current?.focus();
      panelYaAbierto.current = true;
    } else if (panelYaAbierto.current) {
      panelYaAbierto.current = false;
      botonFiltrosRef.current?.focus();
    }
  }, [fcOpen]);

  // Paginación: en tarjetas cuenta tarjetas (cuentas); en tabla, pedidos. Tamaño: lo elegido o el automático (50 en tabla)
  const enTabla = vista === 'tabla';
  const unidades: Array<(typeof cuentas)[number] | Pedido> = enLista || enTabla ? pedidosFiltrados : cuentas;
  const porPagina = tamanoPagina(filas, unidades.length, enLista ? 25 : enTabla ? 50 : pedidosPorPagina);
  const totalPaginas = Math.max(1, Math.ceil(unidades.length / porPagina));
  const paginaValida = Math.min(paginaActual, totalPaginas);
  // Al cambiar de página se vuelve al inicio de la lista (si no, en celular queda a media pantalla)
  const listaRef = useRef<HTMLDivElement>(null);
  const primeraPagina = useRef(true);
  useEffect(() => {
    if (primeraPagina.current) {
      primeraPagina.current = false;
      return;
    }
    listaRef.current?.scrollIntoView?.({ block: 'start' });
  }, [paginaValida]);
  const pagina = useMemo(() => {
    const inicio = (paginaValida - 1) * porPagina;
    return unidades.slice(inicio, inicio + porPagina);
    // unidades cambia con cuentas/pedidosFiltrados/vista
     
  }, [cuentas, pedidosFiltrados, enTabla, enLista, paginaValida, porPagina]);
  const pedidosPaginados = pagina as typeof cuentas;
  const filasTabla = pagina as Pedido[];
  // Si la página guardada quedó fuera de rango (menos pedidos o pantalla más grande), se reajusta de verdad
  useEffect(() => {
    setPaginaActual((p) => (p > totalPaginas ? totalPaginas : p));
  }, [totalPaginas]);
  const desde = unidades.length === 0 ? 0 : (paginaValida - 1) * porPagina + 1;
  const hasta = Math.min(paginaValida * porPagina, unidades.length);
  // «Todas» no pasa del tope de carga: si el filtro tiene más, se avisa
  const avisoTope = filas === 'todas' && totalDia > pedidos.length && paginasRef.current >= MAX_PAGINAS_AUTOMATICAS
    ? `Solo se muestran ${pedidos.length} de ${totalDia} (tope ${TOPE_TODAS}): acota el filtro para ver el resto`
    : null;

  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => String(p.id) === pedidoSeleccionadoId) || (pedidoExterno && String(pedidoExterno.id) === pedidoSeleccionadoId ? pedidoExterno : null);
  }, [pedidos, pedidoSeleccionadoId, pedidoExterno]);

  const abrirNuevoPedido = async () => {
    try {
      const r = await salonApi.obtenerMesas();
      setPisosSalon(r.pisos || []);
    } catch {
      setPisosSalon([]);
    }
    setNuevoPedidoAbierto(true);
  };

  if (cargando) {
    return <Cargando mensaje="Cargando pedidos..." />;
  }

  if (errorCarga) {
    return (
      <div style={{ padding: 24 }}>
        <EstadoError
          mensaje={errorCarga}
          alReintentar={() => {
            setCargando(true);
            cargarDatos();
          }}
        />
      </div>
    );
  }

  const enProgramados = grupoEstado === 'prog';
  const enNoEntregados = grupoEstado === 'noent' || enProgramados;
  const totalNoEntregados = noEntregados?.total ?? 0;
  const puedeCortesia = tiene('cortesias/dar');

  const filtrosActivos = (
    <>
    {(chips.length > 0 || orden !== ORDEN_POR_DEFECTO || chipTodo) && (
      <div className="cj2-activos" aria-label="Filtros activos">
        {chipTodo && (
          <button type="button" className="cj2-quitar" aria-label="Quitar Mostrando todo el día" onClick={limpiarFiltros}>
            Mostrando: todo el día <span aria-hidden="true">✕</span>
          </button>
        )}
        {orden !== ORDEN_POR_DEFECTO && (
          <button type="button" className="cj2-quitar" aria-label="Quitar orden: más tiempo primero" onClick={() => cambiarOrden(ORDEN_POR_DEFECTO)}>
            <span aria-hidden="true">↑↓ </span>Orden: más tiempo primero <span aria-hidden="true">×</span>
          </button>
        )}
        {chips.map((c) => (
          <button key={c.id} type="button" className="cj2-quitar" aria-label={`Quitar filtro ${c.texto}`} onClick={c.quitar}>
            {c.texto} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
    )}
    </>
  );

  return (
    <div className="cj2">
    {tiene('pedidos/cambiar_ubicacion') && <BandejaPropuestasUbicacion alAplicar={cargarDatos} />}
    {puedeValidarCobro && <PanelCambioCobro pendientes={cambiosCobro.pendientes} alResolver={() => { cambiosCobro.recargar(); cargarDatos(); }} />}

    {/* Cabecera compacta: caja cerrada e impresoras, atajos y acciones en una sola línea */}
    <div className="cj2-cab">
      <div className="cj2-titulo">
        <h1>Pedidos y caja</h1>
        <button
          type="button"
          className="cj2-info"
          aria-label={SUBTITULO_CAJA}
          title={SUBTITULO_CAJA}
          aria-expanded={infoAbierta}
          onClick={() => setInfoAbierta((a) => !a)}
        >
          <span aria-hidden="true">ⓘ</span>
        </button>
        <span className="cj2-sub" aria-hidden="true">{SUBTITULO_CAJA}</span>
      </div>

      {!enNoEntregados && totalNoEntregados > 0 && (
        <button type="button" className="cj2-atajo cj2-atajo--rust" onClick={() => cambiarGrupoEstado('noent')}>
          {totalNoEntregados} no {totalNoEntregados === 1 ? 'entregado' : 'entregados'}
        </button>
      )}
      {etapa !== 'confirmar' && grupoEstado === 'act' && porConfirmar > 0 && (
        <button
          type="button"
          className="cj2-atajo"
          onClick={() => { setEtapa('confirmar'); setFiltro('todo'); setPaginaActual(1); }}
        >
          {porConfirmar} por confirmar
        </button>
      )}
      {pendientesAnteriores > 0 && rango.modo !== 'pendientes' && (
        <button
          type="button"
          className="cj2-atajo"
          onClick={() => cambiarRango({ modo: 'pendientes', desde: '', hasta: '' })}
        >
          {pendientesAnteriores} de días anteriores
        </button>
      )}

      <span className="cj2-cab-vacio" />
      <div className="cj-estado" style={{ margin: 0 }}>
        <BannerCajaCerrada compacto />
        <FranjaImpresion />
      </div>

      {puedeCortesia && (
        <button type="button" className="cj2-btn cj2-btn--cortesia-cab" onClick={() => setCortesiaSeparadaAbierta(true)}>
          Registrar cortesía
        </button>
      )}
      <AccesoListaEsperaCaja />
      {/* Vista y columnas: dentro de la cabecera para no gastar una fila propia */}
      {!enNoEntregados && (
        <div className="cj2-vistabar cj2-vistabar--cab">
          {enTabla && <SelectorColumnas columnas={columnasTabla} alCambiar={setColumnasTabla} />}
          <ConmutadorVista
            vista={vista}
            opciones={VISTAS_CAJA}
            alCambiar={(v) => { setVista(v); setPaginaActual(1); }}
          />
        </div>
      )}
      <button type="button" className="cj2-btn cj2-btn--nuevo cj2-btn--nuevo-cab cj-nuevo" onClick={abrirNuevoPedido}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Nuevo pedido
      </button>
      {puedeCortesia && (
        <div className="cj2-mas-menu cj2-mas-menu--cel" ref={masRef}>
          <button
            type="button"
            className="cj2-btn cj2-btn--ico"
            aria-label="Más acciones"
            aria-expanded={masAbierto}
            onClick={() => setMasAbierto((a) => !a)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
          {masAbierto && (
            <div className="cj2-menu" role="menu" aria-label="Más acciones">
              <button type="button" role="menuitem" onClick={() => { setMasAbierto(false); setCortesiaSeparadaAbierta(true); }}>
                Registrar cortesía
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {infoAbierta && <p className="cj2-nota" role="note">{SUBTITULO_CAJA}</p>}

    {/* Barra de control (fija arriba al desplazar): estados, buscador, atajo y Filtros; debajo, los filtros activos */}
    <div className="cj2-control">
    {/* Los cuatro filtros visibles, buscador y panel de Filtros */}
    {!enNoEntregados && (
      <div className="cj2-fila" ref={filaFiltrosRef}>
        <div className="cj2-busqueda">
          <svg className="cj2-busqueda-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <label htmlFor="ord-q" style={{ position: 'absolute', left: -9999 }}>
            Buscar
          </label>
          <input
            id="ord-q"
            type="search"
            className="cj2-buscar"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
            placeholder="Buscar por código, cliente o celular"
          />
          {busqueda && (
            <button
              type="button"
              className="cj2-busqueda-x"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setBusqueda('');
                setPaginaActual(1);
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
        {nActivos > 0 && (
          <button type="button" className="cj2-limpiar cj2-limpiar--linea" onClick={limpiarFiltros}>Limpiar</button>
        )}
        <button
          type="button"
          ref={botonFiltrosRef}
          className="cj2-btn cj2-btn--filtros"
          onClick={() => setFcOpen(!fcOpen)}
          aria-expanded={fcOpen}
          aria-controls="cj2-panel-filtros"
          style={{ background: fcOpen ? 'var(--cp-navy, #0B2C3E)' : undefined, color: fcOpen ? 'var(--cp-cream, #FBF4EC)' : undefined }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
          {nActivos > 0 && <span className="cj2-n-filtros" aria-label={`${nActivos} filtros activos`}>{nActivos}</span>}
        </button>

        {fcOpen && (
          <>
            <div className="cj2-panel-fondo" onClick={() => setFcOpen(false)} />
            <div className="cj2-panel" id="cj2-panel-filtros" role="group" aria-label="Filtros" ref={panelRef} tabIndex={-1}>
              <div className="cj2-panel-cab">
                <span>Filtros</span>
                {nActivos > 0 && <button type="button" className="cj2-limpiar" onClick={limpiarFiltros}>Limpiar</button>}
                <button type="button" className="cj2-btn" onClick={() => setFcOpen(false)}>Listo</button>
              </div>
              <section className="cj2-panel-sec" aria-label="Estado y día">
                <h3 className="cj2-panel-tit">Estado y día</h3>
<nav aria-label="Estado de los pedidos" className="cj2-pastillas">
                  {FILTROS_CAJA.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="cj2-pastilla"
                      aria-pressed={filtro === f.id}
                      onClick={() => { setFiltro(f.id); setPaginaActual(1); }}
                    >
                      {f.punto && <span aria-hidden="true" className="cj2-punto" style={{ background: f.punto, boxShadow: filtro === f.id ? '0 0 0 2px #FBF4EC' : undefined }} />}
                      {f.n}
                      <span className="cj2-cuenta" data-testid={`cuenta-${f.id}`}>{conteos[f.id]}</span>
                    </button>
                  ))}
                </nav>
                <button type="button" className="cj2-pastilla cj2-pastilla--todo" aria-pressed={vistaTodo} onClick={verTodoElDia}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
                  Todo el día
                  {vistaTodo && <span aria-hidden="true">✓</span>}
                </button>
              </section>
              <BarraFiltros>
                <FiltroCombo
                  etiqueta="Estado"
                  valor={grupoEstado}
                  valorPorDefecto={estadoPorDefectoDeRango(rango)}
                  opciones={[
                    { valor: 'act', etiqueta: 'Activos' },
                    { valor: 'cer', etiqueta: 'Cerrados' },
                    { valor: 'todos', etiqueta: 'Todos (activos y cerrados)' },
                    { valor: 'noent', etiqueta: 'No entregados', cantidad: totalNoEntregados },
                    { valor: 'prog', etiqueta: 'Programados' },
                  ]}
                  alCambiar={(v) => {
                    cambiarGrupoEstado(v as GrupoEstadoCaja);
                    if (v === 'noent' || v === 'prog') setFcOpen(false);
                  }}
                />
                <FiltroCombo
                  etiqueta="Etapa"
                  valor={etapa}
                  opciones={ETAPA_OPCIONES.map((e) => ({ valor: e.id, etiqueta: e.n }))}
                  alCambiar={(v) => {
                    setEtapa(v as EtapaCaja);
                    setPaginaActual(1);
                  }}
                />
                <FiltroDiasPedidos rango={rango} pendientesAnteriores={pendientesAnteriores} alCambiar={cambiarRango} />
                <FiltroCombo
                  etiqueta="Canal"
                  valor={canalFiltro}
                  opciones={CANALES_OPCIONES.map((c) => ({ valor: c.id, etiqueta: c.n }))}
                  alCambiar={(v) => {
                    setCanalFiltro(v);
                    setPaginaActual(1);
                  }}
                />
                <FiltroCombo
                  etiqueta="Modalidad"
                  valor={modalidadFiltro}
                  opciones={MODALIDADES_OPCIONES.map((m) => ({ valor: m.id, etiqueta: m.n }))}
                  alCambiar={(v) => {
                    setModalidadFiltro(v);
                    setPaginaActual(1);
                  }}
                />
                <FiltroMedios medios={mediosFiltro} alCambiar={cambiarMedios} />
                <FiltroCombo
                  etiqueta="Cobro"
                  valor={cobroFiltro}
                  opciones={COBRO_OPCIONES.map((c) => ({ valor: c.id, etiqueta: c.n }))}
                  alCambiar={(v) => {
                    setCobroFiltro(v);
                    setPaginaActual(1);
                  }}
                />
              </BarraFiltros>
              <div className="cj2-orden" role="group" aria-label="Orden por tiempo">
                <span className="cj2-orden-t">Orden por tiempo</span>
                {(['mas', 'menos'] as const).map((o) => (
                  <button key={o} type="button" className="cj2-orden-op" aria-pressed={orden === o} onClick={() => cambiarOrden(o)}>
                    {TEXTO_ORDEN[o]}
                  </button>
                ))}
              </div>
              {filtrosActivos}
            </div>
          </>
        )}
      </div>
    )}

    {enNoEntregados && filtrosActivos}
    </div>

    {enProgramados ? (
      <div className="cj-right cj2-noentregados">
        <PanelProgramados puedePasar={tiene('pedidos/cambiar_estado')} alActualizar={() => void cargarDatos()} />
      </div>
    ) : enNoEntregados ? (
      <div className="cj-right cj2-noentregados">
        <PanelNoEntregados
          datos={noEntregados}
          cargando={cargandoNoEntregados}
          error={errorNoEntregados}
          puedeLiquidar={puedeLiquidar}
          puedeDevolver={tiene('pedidos/cambiar_estado')}
          puedeDescartar={tiene('pedidos/cambiar_estado') && (tieneRolUsuario(usuario, 'ADMIN') || tieneRolUsuario(usuario, 'SUPERVISOR'))}
          alActualizar={() => {
            void cargarNoEntregados();
            void cargarDatos();
          }}
        />
      </div>
    ) : (
      <>
        {/* RESUMEN DEL DÍA: una fila; cada contador filtra por ese estado */}
        <section className="cj2-resumen" aria-label="Resumen del día" data-testid="resumen-dia">
          <button type="button" className="cj2-res-plegar" aria-expanded={resumenAbierto} onClick={alternarResumen}>
            <span aria-hidden="true">{resumenAbierto ? '▾' : '▸'} </span>Resumen
          </button>
          <span className="cj2-resumen-t" title={rango.modo === 'hoy' ? 'Total del día' : 'Total'}>
            <strong>{resumen.total}</strong> {resumen.total === 1 ? 'pedido' : 'pedidos'}
          </span>
          {resumenAbierto && (
            <>
              <button type="button" className="cj2-res" aria-pressed={grupoEstado === 'act' && !contador} onClick={() => elegirContador('activos')}>
                <strong>{resumen.activos}</strong> {resumen.activos === 1 ? 'activo' : 'activos'}
              </button>
              <button type="button" className="cj2-res" aria-pressed={contador === 'entregados'} onClick={() => elegirContador('entregados')}>
                <strong>{resumen.entregados}</strong> {resumen.entregados === 1 ? 'entregado' : 'entregados'}
              </button>
              <button type="button" className="cj2-res cj2-res--cerrado" aria-pressed={contador === 'anulados'} onClick={() => elegirContador('anulados')}>
                <strong>{resumen.anulados}</strong> {resumen.anulados === 1 ? 'anulado' : 'anulados'}
              </button>
              {(resumen.rechazados > 0 || contador === 'rechazados') && (
                <button type="button" className="cj2-res cj2-res--cerrado" aria-pressed={contador === 'rechazados'} onClick={() => elegirContador('rechazados')}>
                  <strong>{resumen.rechazados}</strong> {resumen.rechazados === 1 ? 'rechazado' : 'rechazados'}
                </button>
              )}
              <button type="button" className="cj2-res" aria-pressed={contador === 'porcobrar'} onClick={() => elegirContador('porcobrar')}>
                <strong>{resumen.porCobrar}</strong> por cobrar
              </button>
            </>
          )}
          <span
            className="cj2-ventas"
            data-testid="montos-resumen"
            title="Ventas: pedidos no anulados ni rechazados, total neto (ya descontados puntos y cupones; la propina va aparte). Cobrado: los ya pagados. Por cobrar: los vivos aún sin pagar (los de «por cobrar»)."
          >
            {filtrado && <span className="cj2-m-fil">Filtrado: {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}</span>}
            <span className="cj2-m cj2-m--ventas">Ventas <strong>S/ {soles(montos.ventas)}</strong></span>
            <span className="cj2-m cj2-m--cobrado">Cobrado <strong>S/ {soles(montos.cobrado)}</strong></span>
            <span className="cj2-m cj2-m--pend">Por cobrar <strong>S/ {soles(montos.montoPorCobrar)}</strong></span>
            {filtrado && <span className="cj2-m-dia">Día: S/ {soles(resumen.ventas)}</span>}
            <span aria-hidden="true" className="cj2-ventas-i">ⓘ</span>
          </span>
        </section>

        {/* TARJETAS / TABLA / LISTA */}
        <div className="cj2-lista" ref={listaRef}>
          {unidades.length === 0 ? (
            <div className="cj2-vacio">
              {pedidos.length > 0 ? (
                <>
                  <div>No hay pedidos con estos filtros.</div>
                  <button type="button" className="cj2-btn" style={{ marginTop: 12 }} onClick={limpiarFiltros}>Limpiar filtros</button>
                </>
              ) : rango.modo === 'hoy' ? (
                'No hay pedidos hoy.'
              ) : rango.modo === 'pendientes' ? (
                'No hay pedidos pendientes de días anteriores.'
              ) : (
                'No hay pedidos en ese rango.'
              )}
            </div>
          ) : (
            enLista ? (
              <ListaCaja
                filas={filasTabla}
                accionDe={accionDe}
                resaltados={pedidosResaltados}
                alAccion={ejecutarAccion}
                alVerDetalle={(p) => setDetalleVentaId(String(p.id))}
                alAbrir={abrirDetalle}
              />
            ) : enTabla ? (
              <TablaCaja
                filas={filasTabla}
                todas={pedidosFiltrados}
                columnas={columnasTabla}
                alVerDetalle={(p) => setDetalleVentaId(String(p.id))}
              />
            ) : (
            <div className="cj2-cuadricula" data-columnas={columnas} style={{ ['--cj2-cols' as string]: columnas }}>
              {pedidosPaginados.map((cuenta) => {
                if (cuenta.miembros.length > 1) {
                  return (
                    <TarjetaCuentaCaja
                      key={`cuenta-${cuenta.raizId}`}
                      cuenta={cuenta}
                      seleccionadoId={pedidoSeleccionadoId}
                      resaltados={pedidosResaltados}
                      puedeCambiarPago={tiene('pedidos/ajustar_pago')}
                      cajaCerradaEspera={(m) => esperaCajaCerrada(m, cajaAbierta)}
                      alSeleccionar={(id) => setPedidoSeleccionadoId(String(id))}
                      accionDe={accionDe}
                      alAccion={ejecutarAccion}
                      alComerLocal={() => void cargarDatos()}
                    />
                  );
                }
                const o = cuenta.miembros[0];
                return (
                  <TarjetaPedidoCaja
                    key={o.id}
                    pedido={o}
                    seleccionado={pedidoSeleccionadoId === String(o.id)}
                    resaltado={pedidosResaltados.has(String(o.id))}
                    cajaCerradaEspera={esperaCajaCerrada(o, cajaAbierta)}
                    cambioCobroPendiente={cambiosCobro.pendientes.some((c) => c.pedidoId === String(o.id))}
                    puedeCambiarPago={tiene('pedidos/ajustar_pago')}
                    alSeleccionar={(id) => setPedidoSeleccionadoId(String(id))}
                    accion={accionDe(o)}
                    alAccion={ejecutarAccion}
                    alVerDetalle={(p) => setDetalleVentaId(String(p.id))}
                    alComerLocal={() => void cargarDatos()}
                  />
                );
              })}
            </div>
            )
          )}
        </div>

        {/* PAGINADOR: al final de la lista, pequeño y sin posición fija */}
        <PaginadorCaja
          total={unidades.length}
          desde={desde}
          hasta={hasta}
          pagina={paginaValida}
          totalPaginas={totalPaginas}
          alIr={setPaginaActual}
          filas={filas === null && (enTabla || enLista) ? (enLista ? 25 : 50) : filas}
          alCambiarFilas={(f) => { setFilas(f); setPaginaActual(1); }}
          conAuto={!enTabla && !enLista}
          avisoTope={avisoTope}
          carga={{ cargados: pedidos.length, totalServidor: totalDia, cargando: cargandoMas, alCargarMas: () => void cargarMas(), error: errorMas, buscando: filtrando }}
        />
      </>
    )}

    {/* Botón flotante Nuevo pedido (solo celular; el de la cabecera se oculta allí) */}
    <button type="button" className="cj2-fab" aria-label="Agregar nuevo pedido" onClick={abrirNuevoPedido}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>

    {/* VENTANA DEL DETALLE: modal en PC, hoja inferior en tablet y celular */}
    {pedidoSeleccionado && (
      <VentanaDetalle
        titulo={`Detalle del pedido ${pedidoSeleccionado.codigo}`}
        alCerrar={() => setPedidoSeleccionadoId(null)}
      >
        <div className="cj-right">
          <PedidoDetalle
            pedido={pedidoSeleccionado}
            cajaAbierta={cajaAbierta}
            alActualizar={cargarDatos}
            alRepetir={(p) => {
              setPedidoRepetir(p);
              setNuevoPedidoAbierto(true);
            }}
            alEditar={(p) => void abrirEditor(p)}
            alAgregarExtra={(p) => setPedidoExtra(p)}
            alAbrirPedido={(id) => setPedidoSeleccionadoId(String(id))}
            editandoPor={editando[String(pedidoSeleccionado.id)]?.nombre ?? null}
          />
        </div>
      </VentanaDetalle>
    )}

    {detalleVentaId && <DetalleVentaModal pedidoId={detalleVentaId} alCerrar={() => setDetalleVentaId(null)} />}

    {dialogosAcciones}

    {cortesiaSeparadaAbierta && (
      <RegistrarCortesiaModal
        alCerrar={() => setCortesiaSeparadaAbierta(false)}
        alRegistrar={() => {
          setCortesiaSeparadaAbierta(false);
          cargarDatos();
        }}
      />
    )}

    {errorEditar && (
      <div role="alert" className="cj-aviso-editar" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 70, background: '#FDECE8', border: '1.5px solid var(--cp-rust)', borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: 'var(--cp-rust)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{errorEditar}</span>
        <button type="button" onClick={() => setErrorEditar(null)} aria-label="Cerrar aviso" style={{ border: 0, background: 'transparent', fontWeight: 800, cursor: 'pointer' }}>×</button>
      </div>
    )}

    {pedidoExtra && (
      <ModalNuevoPedidoMesa
        abierto={true}
        pasoInicial="modal"
        pisos={pisosSalon}
        extra={pedidoExtra}
        alCerrar={() => setPedidoExtra(null)}
        alExitoPedido={() => void cargarDatos()}
        alRefrescarMesas={async () => void cargarDatos()}
      />
    )}

    {edicionPedido && (
      <ModalNuevoPedidoMesa
        abierto={true}
        pasoInicial="modal"
        pisos={pisosSalon}
        edicion={{ datos: edicionPedido }}
        alCerrar={() => setEdicionPedido(null)}
        alExitoPedido={() => void cargarDatos()}
        alRefrescarMesas={async () => void cargarDatos()}
      />
    )}

    {nuevoPedidoAbierto && (
      <ModalNuevoPedidoMesa
        abierto={true}
        puedeForzarLiberacion={tiene('mesas/liberar')}
        pasoInicial="modal"
        pisos={pisosSalon}
        pedidoRepetir={pedidoRepetir}
        alCerrar={() => {
          setNuevoPedidoAbierto(false);
          setPedidoRepetir(null);
        }}
        alExitoPedido={(res) => {
          if (res?.id) {
            setPedidoSeleccionadoId(String(res.id));
          }
          void cargarDatos();
        }}
        alRefrescarMesas={async () => void cargarDatos()}
      />
    )}
    </div>
  );
}
