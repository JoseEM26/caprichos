import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { useEventos } from '../../comun/socket';
import { pedidosApi, Pedido, RespuestaNoEntregados } from './pedidosApi';
import { PedidoDetalle } from './PedidoDetalle';
import { PanelNoEntregados } from './PanelNoEntregados';
import { useSesion } from '../../comun/sesion';
import { ModalNuevoPedidoMesa } from '../salon/componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../salon/api';
import type { PisoSalon } from '../salon/tipos';
import { reproducirCampana } from './audioAlerta';
import { FranjaImpresion } from './FranjaImpresion';
import { BannerCajaCerrada, EtiquetaCajaCerrada, esperaCajaCerrada, useEstadoCajaHoy } from './BannerCajaCerrada';
import './pedidos.css';

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

export type ClaveTabCaja = 'nuevo' | 'coord' | 'curso' | 'cerrado' | 'no_entregados';

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
];

export function PedidosAdminView() {
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string>('');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nuevoPedidoAbierto, setNuevoPedidoAbierto] = useState(false);
  const [pedidoRepetir, setPedidoRepetir] = useState<Pedido | null>(null);
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

  // Dropdown open states
  const [openGroup, setOpenGroup] = useState<'canal' | 'modal' | 'cobro' | null>(null);

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const pedidosPorPagina = 4; // Mockup usa OPAGE = 4

  // Alerta sonora y visual
  const [pedidosResaltados, setPedidosResaltados] = useState<Set<string>>(new Set());

  // Delivery no entregados (pestaña propia, con su contador)
  const { tiene } = useSesion();
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

  // Carga inicial y refresco
  const cargarDatos = useCallback(async () => {
    setErrorCarga('');
    try {
      const resPedidos = await pedidosApi.listar({ limite: 100 });
      setPedidos(resPedidos.items || []);
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los pedidos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    void cargarNoEntregados();
  }, [cargarDatos, cargarNoEntregados]);

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

  useEventos('pedido:pago', (datos: { id: string | number }) => {
    const idStr = String(datos.id);
    setPedidos((prev) =>
      prev.map((p) => (String(p.id) === idStr ? { ...p, pago_estado: 'PAGADO' } : p)),
    );
  });

  // Conteo de pestañas
  const conteosTabs = useMemo(() => {
    const res: Record<Exclude<ClaveTabCaja, 'no_entregados'>, number> = {
      nuevo: 0,
      coord: 0,
      curso: 0,
      cerrado: 0,
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
    <BannerCajaCerrada />
    <FranjaImpresion />
    <div className="cj-grid">
      {/* PANEL IZQUIERDO */}
      <div className="cj-left">
        <div className="cj-head">
          {/* Botón Nuevo pedido (solo si tiene permiso) */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
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
                flex: '1 1 150px',
                minHeight: 52,
                border: 0,
                borderRadius: 12,
                background: 'var(--cp-orange, #E67929)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Nuevo pedido
            </button>
          </div>

          {/* 4 Pestañas principales */}
          <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TABS_CAJA.map((t) => {
              const activo = tabActiva === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activo}
                  type="button"
                  onClick={() => cambiarTab(t.id)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: activo ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                    color: activo ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {t.n} · {conteosTabs[t.id]}
                </button>
              );
            })}
            <button
              key="no_entregados"
              role="tab"
              aria-selected={tabActiva === 'no_entregados'}
              type="button"
              onClick={() => cambiarTab('no_entregados')}
              style={{
                minHeight: 44,
                padding: '0 14px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-rust, #B2500F)',
                background: tabActiva === 'no_entregados' ? 'var(--cp-rust, #B2500F)' : 'transparent',
                color: tabActiva === 'no_entregados' ? 'var(--cp-white, #FFFFFF)' : 'var(--cp-rust, #B2500F)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              No entregados · {noEntregados?.total ?? 0}
            </button>
          </div>

          {/* Buscador y Filtros (no aplican a No entregados) */}
          {tabActiva !== 'no_entregados' && (
          <div
            style={{
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 12,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                  flex: 1,
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
            </div>

            {fcSummary && (
              <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
                <b>Filtrando:</b> {fcSummary}
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', fontWeight: 600 }}>
              {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
            </div>

            {/* Dropdown groups */}
            {fcOpen && (
              <div
                style={{
                  borderTop: '1px solid var(--cp-line, #E3D6C6)',
                  paddingTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 20px',
                }}
              >
                {/* CANAL */}
                <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft, #2C4C5D)', marginBottom: 3 }}>
                    CANAL
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(openGroup === 'canal' ? null : 'canal')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background: canalFiltro !== 'all' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{CANALES_OPCIONES.find((c) => c.id === canalFiltro)?.n}</span>
                    <span aria-hidden="true" style={{ flex: 'none', fontSize: 12 }}>
                      {openGroup === 'canal' ? '▲' : '▼'}
                    </span>
                  </button>
                  {openGroup === 'canal' && (
                    <div
                      role="listbox"
                      style={{
                        position: 'absolute',
                        zIndex: 20,
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        borderRadius: 10,
                        background: 'var(--cp-white, #FFFFFF)',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(11,44,62,0.15)',
                      }}
                    >
                      {CANALES_OPCIONES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCanalFiltro(c.id);
                            setOpenGroup(null);
                            setPaginaActual(1);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 40,
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-line, #E3D6C6)',
                            background: canalFiltro === c.id ? 'var(--cp-sand, #EDE1D1)' : 'transparent',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: canalFiltro === c.id ? 800 : 500,
                            textAlign: 'left',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {c.n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* MODALIDAD */}
                <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft, #2C4C5D)', marginBottom: 3 }}>
                    MODALIDAD
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(openGroup === 'modal' ? null : 'modal')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background: modalidadFiltro !== 'all' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{MODALIDADES_OPCIONES.find((m) => m.id === modalidadFiltro)?.n}</span>
                    <span aria-hidden="true" style={{ flex: 'none', fontSize: 12 }}>
                      {openGroup === 'modal' ? '▲' : '▼'}
                    </span>
                  </button>
                  {openGroup === 'modal' && (
                    <div
                      role="listbox"
                      style={{
                        position: 'absolute',
                        zIndex: 20,
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        borderRadius: 10,
                        background: 'var(--cp-white, #FFFFFF)',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(11,44,62,0.15)',
                      }}
                    >
                      {MODALIDADES_OPCIONES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setModalidadFiltro(m.id);
                            setOpenGroup(null);
                            setPaginaActual(1);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 40,
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-line, #E3D6C6)',
                            background: modalidadFiltro === m.id ? 'var(--cp-sand, #EDE1D1)' : 'transparent',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: modalidadFiltro === m.id ? 800 : 500,
                            textAlign: 'left',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {m.n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* COBRO */}
                <div style={{ flex: '1 1 200px', minWidth: 0, position: 'relative' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft, #2C4C5D)', marginBottom: 3 }}>
                    COBRO
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(openGroup === 'cobro' ? null : 'cobro')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      background: cobroFiltro !== 'all' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white, #FFFFFF)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 700,
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{COBRO_OPCIONES.find((c) => c.id === cobroFiltro)?.n}</span>
                    <span aria-hidden="true" style={{ flex: 'none', fontSize: 12 }}>
                      {openGroup === 'cobro' ? '▲' : '▼'}
                    </span>
                  </button>
                  {openGroup === 'cobro' && (
                    <div
                      role="listbox"
                      style={{
                        position: 'absolute',
                        zIndex: 20,
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        borderRadius: 10,
                        background: 'var(--cp-white, #FFFFFF)',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(11,44,62,0.15)',
                      }}
                    >
                      {COBRO_OPCIONES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCobroFiltro(c.id);
                            setOpenGroup(null);
                            setPaginaActual(1);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 40,
                            padding: '0 12px',
                            border: 0,
                            borderBottom: '1px solid var(--cp-line, #E3D6C6)',
                            background: cobroFiltro === c.id ? 'var(--cp-sand, #EDE1D1)' : 'transparent',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: cobroFiltro === c.id ? 800 : 500,
                            textAlign: 'left',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {c.n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
              No hay pedidos en esta pestaña.
            </div>
          ) : (
            pedidosPaginados.map((o) => {
              const seleccionado = pedidoSeleccionadoId === o.id;
              const resaltado = pedidosResaltados.has(String(o.id));
              const itemsTexto = (o.lineas || []).map((l) => `${l.cantidad}× ${l.nombre}`).join(', ');
              const badge = getBadge(o);
              const cajaCerradaEspera = esperaCajaCerrada(o, cajaAbierta);

              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPedidoSeleccionadoId(o.id)}
                  className={`cj-pedido-card ${resaltado ? 'cj-resaltado' : ''}`}
                  style={{
                    textAlign: 'left',
                    background: 'var(--cp-white, #FFFFFF)',
                    border: `1.5px solid ${seleccionado ? 'var(--cp-orange, #E67929)' : 'var(--cp-line, #E3D6C6)'}`,
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
                      {o.codigo}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 9999,
                        padding: '2px 10px',
                        background: badge.bg,
                        color: badge.fg,
                      }}
                    >
                      {badge.l}
                    </span>
                    {cajaCerradaEspera && <EtiquetaCajaCerrada />}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                    {canalLabel(o.canal)} · {modLabel(o.modalidad)} · {o.cliente_nombre || 'Cliente'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      {itemsTexto || '1 producto'}
                    </span>
                    <span style={{ fontWeight: 800, color: 'var(--cp-rust, #B2500F)', whiteSpace: 'nowrap' }}>
                      s/ {Number(o.total || 0).toFixed(2)}
                    </span>
                  </div>
                </button>
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
          />
        )}
      </div>
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
