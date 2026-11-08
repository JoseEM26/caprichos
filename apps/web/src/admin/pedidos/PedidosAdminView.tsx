import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { FiltroCombo } from '../../comun/FiltroCombo';
import { useEventos, useTiempoReal } from '../../comun/socket';
import { pedidosApi, Pedido, RespuestaNoEntregados, type DatosEdicionPedido } from './pedidosApi';
import { PedidoDetalle } from './PedidoDetalle';
import { BandejaPropuestasUbicacion } from './BandejaPropuestasUbicacion';
import { PanelCambioCobro, useCambiosCobroPendientes } from './PanelCambioCobro';
import { PanelNoEntregados } from './PanelNoEntregados';
import { useSesion } from '../../comun/sesion';
import { ModalNuevoPedidoMesa } from '../salon/componentes/ModalNuevoPedidoMesa';
import { RegistrarCortesiaModal } from '../cortesias/RegistrarCortesiaModal';
import { salonApi } from '../salon/api';
import type { PisoSalon } from '../salon/tipos';
import { reproducirCampana } from './audioAlerta';
import { FranjaImpresion } from './FranjaImpresion';
import { BannerCajaCerrada, esperaCajaCerrada, useEstadoCajaHoy } from './BannerCajaCerrada';
import './pedidos.css';
import { FiltroDiasPedidos } from './FiltroDiasPedidos';
import { RangoPedidos, parametrosDeRango, rangoHoy } from './filtroDias';
import { nombreMedio } from './planPago';
import { TarjetaPedidoCaja } from './TarjetaPedidoCaja';

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
  return m;
}

export function getBadge(p: Pedido) {
  const est = String(p.estado || '').toUpperCase();
  const pag = String(p.pago_estado || '').toUpperCase();
  const mod = String(p.modalidad || '').toUpperCase();
  const tieneCoordinado = Boolean(p.pago_coordinado_en) || pag === 'COORDINADO';
  const esPorConfirmar =
    (est === 'COLA' || est === 'NUEVO') &&
    pag !== 'PAGADO' &&
    !tieneCoordinado &&
    mod !== 'MESA';
  if (esPorConfirmar) {
    return { l: 'Por confirmar', bg: 'var(--cp-orange, #E67929)', fg: 'var(--cp-navy, #0B2C3E)' };
  }
  switch (est) {
    case 'COLA':
      return { l: 'En cocina · nuevo', bg: 'var(--cp-gold, #F5C84B)', fg: 'var(--cp-navy, #0B2C3E)' };
    case 'PREPARANDO':
      return { l: 'Preparando', bg: 'var(--cp-gold, #F5C84B)', fg: 'var(--cp-navy, #0B2C3E)' };
    case 'LISTO':
      return { l: 'Listo', bg: 'var(--cp-navy, #0B2C3E)', fg: 'var(--cp-cream, #FBF4EC)' };
    case 'EN_CAMINO':
    case 'RUTA':
      return { l: 'En camino', bg: 'var(--cp-soft, #2C4C5D)', fg: 'var(--cp-cream, #FBF4EC)' };
    case 'ENTREGADO':
      return { l: 'Entregado', bg: 'var(--cp-line, #E3D6C6)', fg: 'var(--cp-navy, #0B2C3E)' };
    case 'ANULADO':
    case 'RECHAZADO':
      return { l: 'Rechazado', bg: 'var(--cp-white, #FFFFFF)', fg: 'var(--cp-rust, #B2500F)' };
    default:
      return { l: p.estado, bg: 'var(--cp-sand, #EDE1D1)', fg: 'var(--cp-navy, #0B2C3E)' };
  }
}

/** Chip «Cobrado por mozo · Yape»; en naranja y «falta voucher» si el medio digital no tiene foto legible. */
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
      {alerta && <strong> · falta voucher</strong>}
    </span>
  );
}

export type ClaveTabCaja = 'nuevo' | 'coord' | 'curso' | 'cerrado' | 'todos' | 'no_entregados';

interface TabDef {
  id: Exclude<ClaveTabCaja, 'no_entregados'>;
  n: string;
  filtro: (p: Pedido) => boolean;
}

const TABS_CAJA: TabDef[] = [
  {
    id: 'nuevo',
    n: 'Por confirmar',
    filtro: (p) => {
      const e = String(p.estado || '').toUpperCase();
      const pag = String(p.pago_estado || '').toUpperCase();
      const mod = String(p.modalidad || '').toUpperCase();
      const tieneCoordinado = Boolean(p.pago_coordinado_en) || pag === 'COORDINADO';
      return (e === 'COLA' || e === 'NUEVO') && pag !== 'PAGADO' && !tieneCoordinado && mod !== 'MESA';
    },
  },
  {
    id: 'coord',
    n: 'Pago por coordinar',
    filtro: (p) => {
      const e = String(p.estado || '').toUpperCase();
      const pag = String(p.pago_estado || '').toUpperCase();
      const mod = String(p.modalidad || '').toUpperCase();
      const tieneCoordinado = Boolean(p.pago_coordinado_en) || pag === 'COORDINADO';
      return (
        mod !== 'MESA' &&
        pag !== 'PAGADO' &&
        !tieneCoordinado &&
        e !== 'ANULADO' &&
        e !== 'RECHAZADO' &&
        e !== 'ENTREGADO' &&
        e !== 'COLA' &&
        e !== 'NUEVO'
      );
    },
  },
  {
    id: 'curso',
    n: 'En curso',
    filtro: (p) => {
      const e = String(p.estado || '').toUpperCase();
      const pag = String(p.pago_estado || '').toUpperCase();
      const mod = String(p.modalidad || '').toUpperCase();
      const tieneCoordinado = Boolean(p.pago_coordinado_en) || pag === 'COORDINADO';
      const esNuevoPorConfirmar =
        (e === 'COLA' || e === 'NUEVO') && pag !== 'PAGADO' && !tieneCoordinado && mod !== 'MESA';
      return (
        ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO', 'RUTA', 'PREP'].includes(e) &&
        !esNuevoPorConfirmar
      );
    },
  },
  {
    id: 'cerrado',
    n: 'Cerrados',
    filtro: (p) => {
      const e = String(p.estado || '').toUpperCase();
      return ['ENTREGADO', 'ANULADO', 'RECHAZADO'].includes(e);
    },
  },
  // Todo junto: nuevos, en curso y cerrados (va al final para que el enlace a un pedido abra su pestaña propia)
  { id: 'todos', n: 'Todos', filtro: () => true },
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

export function PedidosAdminView() {
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string>('');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  // Día o rango que muestra la lista (por defecto hoy en Lima; no se recuerda entre visitas)
  const [rango, setRango] = useState<RangoPedidos>(() => rangoHoy());
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
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);
  const pedidoDesdeUrl = useRef<string | null>(new URLSearchParams(window.location.search).get('pedido'));

  // Pestaña activa del mockup: Por confirmar | Pago por coordinar | En curso | Cerrados
  const [tabActiva, setTabActiva] = useState<ClaveTabCaja>('nuevo');

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [fcOpen, setFcOpen] = useState<boolean>(false);
  const [canalFiltro, setCanalFiltro] = useState<string>('all');
  const [modalidadFiltro, setModalidadFiltro] = useState<string>('all');
  const [cobroFiltro, setCobroFiltro] = useState<string>('all');

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const pedidosPorPagina = 4; // Mockup usa OPAGE = 4

  // Alerta sonora y visual
  const [pedidosResaltados, setPedidosResaltados] = useState<Set<string>>(new Set());

  // Delivery no entregados (pestaña propia, con su contador)
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
    try {
      const [resPedidos, pendientes] = await Promise.all([
        pedidosApi.listar({ ...parametrosDeRango(rango), limite: 100 }),
        contarPendientesAnteriores(),
      ]);
      setPedidos(resPedidos.items || []);
      if (pendientes !== null) setPendientesAnteriores(pendientes);
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los pedidos');
    } finally {
      setCargando(false);
    }
  }, [rango]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    void cargarNoEntregados();
  }, [cargarNoEntregados]);

  const cambiarRango = (nuevo: RangoPedidos) => {
    setRango(nuevo);
    setPaginaActual(1);
  };

  const cambiarTab = (nuevaTab: ClaveTabCaja) => {
    setTabActiva(nuevaTab);
    setPaginaActual(1);
    if (nuevaTab === 'no_entregados') {
      void cargarNoEntregados();
      setPedidoSeleccionadoId(null);
      return;
    }
    const tabDef = TABS_CAJA.find((t) => t.id === nuevaTab);
    const filtro = tabDef ? tabDef.filtro : () => true;
    const q = busqueda.trim().toLowerCase();
    const nuevosFiltrados = pedidos.filter((p) => {
      if (!filtro(p)) return false;
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
      if (cobroFiltro !== 'all') {
        const pag = String(p.pago_estado).toUpperCase() === 'PAGADO';
        if (cobroFiltro === 'paid' && !pag) return false;
        if (cobroFiltro === 'unpaid' && pag) return false;
        if (cobroFiltro === 'sincaptura' && !p.cobroMozo?.sinCaptura) return false;
      }
      if (q) {
        const cod = String(p.codigo || '').toLowerCase();
        const cli = String(p.cliente_nombre || '').toLowerCase();
        if (!cod.includes(q) && !cli.includes(q)) return false;
      }
      return true;
    });
    setPedidoSeleccionadoId(nuevosFiltrados[0]?.id || null);
  };

  // Enlace de la campana (/admin/caja?pedido=ID): abre ese pedido en su pestaña, una sola vez
  const deepLinkResuelto = useRef(false);
  useEffect(() => {
    if (cargando || deepLinkResuelto.current) return;
    deepLinkResuelto.current = true;
    const idUrl = new URLSearchParams(window.location.search).get('pedido');
    const pedidoUrl = idUrl ? pedidos.find((p) => String(p.id) === idUrl) : undefined;
    if (!pedidoUrl) return;
    const tab = TABS_CAJA.find((t) => t.filtro(pedidoUrl));
    if (tab) cambiarTab(tab.id);
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
        return [nuevoPedido, ...prev];
      });
      setPedidoSeleccionadoId((prev) => prev || idStr);
    }).catch(() => {
      cargarDatos();
    });
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
  });

  // Tiempo real de Caja: voucher/plan, cobros, cierre y respaldo (reconexión, volver a la pestaña, sondeo sin socket).
  // Recarga en silencio: no toca la selección, el scroll ni el modal abierto.
  useTiempoReal(
    ['vouchers:actualizado', 'pedido:pago', 'caja:cerrada', 'comprobante:cambio', 'reparto:incidente'],
    () => {
      void cargarDatos();
      void cargarNoEntregados();
    },
  );

  // Conteo de pestañas
  const conteosTabs = useMemo(() => {
    const res: Record<Exclude<ClaveTabCaja, 'no_entregados'>, number> = {
      nuevo: 0,
      coord: 0,
      curso: 0,
      cerrado: 0,
      todos: 0,
    };
    for (const t of TABS_CAJA) {
      res[t.id] = pedidos.filter(t.filtro).length;
    }
    return res;
  }, [pedidos]);

  // Filtros activos
  const fcCount = (canalFiltro !== 'all' ? 1 : 0) + (modalidadFiltro !== 'all' ? 1 : 0) + (cobroFiltro !== 'all' ? 1 : 0);
  const fcSummary = useMemo(() => {
    const partes: string[] = [];
    if (canalFiltro !== 'all') {
      partes.push(`Canal: ${CANALES_OPCIONES.find((c) => c.id === canalFiltro)?.n}`);
    }
    if (modalidadFiltro !== 'all') {
      partes.push(`Modalidad: ${MODALIDADES_OPCIONES.find((m) => m.id === modalidadFiltro)?.n}`);
    }
    if (cobroFiltro !== 'all') {
      partes.push(`Cobro: ${COBRO_OPCIONES.find((c) => c.id === cobroFiltro)?.n}`);
    }
    return partes.join(' · ');
  }, [canalFiltro, modalidadFiltro, cobroFiltro]);

  // Lista filtrada
  const pedidosFiltrados = useMemo(() => {
    // La pestaña No entregados no usa esta lista: su panel lee la consulta propia
    if (tabActiva === 'no_entregados') return [];
    const tabDef = TABS_CAJA.find((t) => t.id === tabActiva);
    const filtroTab = tabDef ? tabDef.filtro : () => true;
    const q = busqueda.trim().toLowerCase();

    return pedidos.filter((p) => {
      if (!filtroTab(p)) return false;

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
      if (cobroFiltro !== 'all') {
        const pag = String(p.pago_estado).toUpperCase() === 'PAGADO';
        if (cobroFiltro === 'paid' && !pag) return false;
        if (cobroFiltro === 'unpaid' && pag) return false;
        if (cobroFiltro === 'sincaptura' && !p.cobroMozo?.sinCaptura) return false;
      }

      if (q) {
        const cod = String(p.codigo || '').toLowerCase();
        const cli = String(p.cliente_nombre || '').toLowerCase();
        if (!cod.includes(q) && !cli.includes(q)) return false;
      }

      return true;
    });
  }, [pedidos, tabActiva, canalFiltro, modalidadFiltro, cobroFiltro, busqueda]);

  // Sincronización automática del pedido seleccionado con la lista visible:
  // Al abrir, o cuando cambian los filtros/búsqueda, si el pedido seleccionado
  // no está en la lista visible, se selecciona el primero (o null si la lista está vacía).
  useEffect(() => {
    if (pedidosFiltrados.length === 0) {
      if (pedidoSeleccionadoId !== null) {
        setPedidoSeleccionadoId(null);
      }
      return;
    }

    // Enlace desde una notificacion (/admin/caja?pedido=<id>): se selecciona ese pedido una vez
    const pedidoDeEnlace = pedidoDesdeUrl.current;
    if (pedidoDeEnlace && pedidosFiltrados.some((p) => String(p.id) === pedidoDeEnlace)) {
      pedidoDesdeUrl.current = null;
      setPedidoSeleccionadoId(pedidoDeEnlace);
      return;
    }

    const estaEnListaVisible = pedidosFiltrados.some(
      (p) => String(p.id) === String(pedidoSeleccionadoId),
    );
    if (!estaEnListaVisible) {
      setPedidoSeleccionadoId(pedidosFiltrados[0].id);
    }
  }, [pedidosFiltrados, pedidoSeleccionadoId]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / pedidosPorPagina));
  const paginaValida = Math.min(paginaActual, totalPaginas);
  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaValida - 1) * pedidosPorPagina;
    return pedidosFiltrados.slice(inicio, inicio + pedidosPorPagina);
  }, [pedidosFiltrados, paginaValida, pedidosPorPagina]);

  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => p.id === pedidoSeleccionadoId) || null;
  }, [pedidos, pedidoSeleccionadoId]);

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

  return (
    <div>
    {/* Caja cerrada e impresoras: una sola línea de chips, sin ocupar la pantalla */}
    <div className="cj-estado">
      <BannerCajaCerrada compacto />
      <FranjaImpresion />
    </div>
    {tiene('pedidos/cambiar_ubicacion') && <BandejaPropuestasUbicacion alAplicar={cargarDatos} />}
    {puedeValidarCobro && <PanelCambioCobro pendientes={cambiosCobro.pendientes} alResolver={() => { cambiosCobro.recargar(); cargarDatos(); }} />}
    <div className="cj-grid">
      {/* PANEL IZQUIERDO */}
      <div className="cj-left">
        <div className="cj-head cj-cabecera">
          {/* Fila 1: día, vista, atajos y Nuevo pedido (en PC van lado a lado) */}
          <div className="cj-barra">
            {/* Día o rango de la lista (hoy por defecto); no cambia la caja del día */}
            <FiltroDiasPedidos rango={rango} pendientesAnteriores={pendientesAnteriores} alCambiar={cambiarRango} />

            {/* Vista de la lista: un combo con la cantidad de cada grupo (antes 5 pestañas) */}
            <div className="cj-barra-vista">
              <FiltroCombo
                etiqueta="Ver pedidos"
                valor={tabActiva}
                valorPorDefecto="nuevo"
                opciones={[
                  ...TABS_CAJA.map((t) => ({ valor: t.id, etiqueta: t.n, cantidad: conteosTabs[t.id] })),
                  { valor: 'no_entregados', etiqueta: 'No entregados', cantidad: noEntregados?.total ?? 0 },
                ]}
                alCambiar={(v) => cambiarTab(v as ClaveTabCaja)}
              />
            </div>
            {/* Atajo visible: lo que necesita atención no queda escondido dentro del combo */}
            {TABS_CAJA.filter((t) => t.id !== tabActiva && t.id === 'nuevo' && conteosTabs[t.id] > 0).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => cambiarTab(t.id)}
                style={{ minHeight: 44, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--cp-orange, #E67929)', background: 'var(--cp-cream, #FBF4EC)', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                {conteosTabs[t.id]} por confirmar
              </button>
            ))}
            {tabActiva !== 'no_entregados' && (noEntregados?.total ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => cambiarTab('no_entregados')}
                style={{ minHeight: 44, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--cp-rust, #B2500F)', background: 'transparent', color: 'var(--cp-rust, #B2500F)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                {noEntregados?.total} no {noEntregados?.total === 1 ? 'entregado' : 'entregados'}
              </button>
            )}

            {tiene('cortesias/dar') && (
              <button
                type="button"
                onClick={() => setCortesiaSeparadaAbierta(true)}
                style={{ minHeight: 44, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Registrar cortesía
              </button>
            )}

            <button
              type="button"
              className="cj-nuevo"
              onClick={async () => {
                try {
                  const r = await salonApi.obtenerMesas();
                  setPisosSalon(r.pisos || []);
                } catch {
                  setPisosSalon([]);
                }
                setNuevoPedidoAbierto(true);
              }}
              style={{
                minHeight: 44,
                padding: '0 18px',
                border: 0,
                borderRadius: 12,
                background: 'var(--cp-orange, #E67929)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Nuevo pedido
            </button>
          </div>

          {/* Fila 2: buscador y filtros (no aplican a No entregados) */}
          {tabActiva !== 'no_entregados' && (
          <div className="cj-barra">
            <label htmlFor="ord-q" style={{ position: 'absolute', left: -9999 }}>
              Buscar
            </label>
            <input
              id="ord-q"
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Buscar por código o cliente"
              style={{
                flex: '1 1 180px',
                minWidth: 0,
                boxSizing: 'border-box',
                minHeight: 44,
                borderRadius: 9999,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-cream, #FBF4EC)',
                color: 'var(--cp-navy, #0B2C3E)',
                padding: '0 14px',
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={() => setFcOpen(!fcOpen)}
              aria-expanded={fcOpen}
              style={{
                flex: 'none',
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                background: fcOpen ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                color: fcOpen ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 700,
                fontSize: 13,
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 5h18l-7 8v6l-4 2v-8z" />
              </svg>
              Filtros
              {fcCount > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    boxSizing: 'border-box',
                    borderRadius: 10,
                    background: 'var(--cp-orange, #E67929)',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                  }}
                >
                  {fcCount}
                </span>
              )}
            </button>
            <span style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
            </span>

            {fcSummary && (
              <div style={{ flex: '1 1 100%', fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
                <b>Filtrando:</b> {fcSummary}
              </div>
            )}

            {/* Filtros desplegables: Canal, Modalidad y Cobro en una segunda fila pegada */}
            {fcOpen && (
              <div className="cj-barra-filtros">
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
                <FiltroCombo
                  etiqueta="Cobro"
                  valor={cobroFiltro}
                  opciones={COBRO_OPCIONES.map((c) => ({ valor: c.id, etiqueta: c.n }))}
                  alCambiar={(v) => {
                    setCobroFiltro(v);
                    setPaginaActual(1);
                  }}
                />
              </div>
            )}
          </div>
          )}
        </div>

        {tabActiva === 'no_entregados' ? (
          <div className="cj-scroll" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: 'var(--cp-navy, #0B2C3E)' }}>
              Pedidos de delivery que no llegaron al cliente: el repartidor se retiró por espera agotada.
            </p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: 'var(--cp-soft, #2C4C5D)' }}>
              Revisa a la derecha los que el cliente acepta reprogramar y los que quedaron cancelados.
            </p>
          </div>
        ) : (
        /* LISTA DE PEDIDOS */
        <div className="cj-scroll" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pedidosPaginados.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--cp-soft, #2C4C5D)', fontSize: 13 }}>
              {pedidos.length > 0
                ? 'No hay pedidos en esta pestaña.'
                : rango.modo === 'hoy'
                  ? 'No hay pedidos hoy.'
                  : rango.modo === 'pendientes'
                    ? 'No hay pedidos pendientes de días anteriores.'
                    : 'No hay pedidos en ese rango.'}
            </div>
          ) : (
            pedidosPaginados.map((o) => {
              return (
                <TarjetaPedidoCaja
                  key={o.id}
                  pedido={o}
                  seleccionado={pedidoSeleccionadoId === o.id}
                  resaltado={pedidosResaltados.has(String(o.id))}
                  cajaCerradaEspera={esperaCajaCerrada(o, cajaAbierta)}
                  cambioCobroPendiente={cambiosCobro.pendientes.some((c) => c.pedidoId === String(o.id))}
                  alSeleccionar={setPedidoSeleccionadoId}
                />
              );
            })
          )}
        </div>
        )}

        {/* PIE CON PAGINACIÓN */}
        <div className="cj-foot">
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              <button
                type="button"
                disabled={paginaValida <= 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  opacity: paginaValida <= 1 ? 0.4 : 1,
                  cursor: paginaValida <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPaginaActual(num)}
                  aria-label={`Página ${num}`}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: 12,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: paginaValida === num ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: paginaValida === num ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={paginaValida >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  opacity: paginaValida >= totalPaginas ? 0.4 : 1,
                  cursor: paginaValida >= totalPaginas ? 'not-allowed' : 'pointer',
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="cj-right">
        {tabActiva === 'no_entregados' ? (
          <PanelNoEntregados
            datos={noEntregados}
            cargando={cargandoNoEntregados}
            error={errorNoEntregados}
            puedeLiquidar={puedeLiquidar}
            puedeDevolver={tiene('pedidos/cambiar_estado')}
            alActualizar={() => {
              void cargarNoEntregados();
              void cargarDatos();
            }}
          />
        ) : !pedidoSeleccionado ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              textAlign: 'center',
              color: 'var(--cp-soft, #2C4C5D)',
              fontSize: 14,
              lineHeight: '21px',
            }}
          >
            Elige un pedido de la lista para ver su detalle, cobrarlo o imprimir sus comprobantes.
          </div>
        ) : (
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
        )}
      </div>
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
    </div>
  );
}
