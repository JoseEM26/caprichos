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
import { useSesion } from '../../comun/sesion';
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
import { nombreMedio } from './planPago';
import { TarjetaPedidoCaja } from './TarjetaPedidoCaja';
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
export type GrupoEstadoCaja = 'act' | 'cer' | 'todos' | 'noent';

/** Hoy y «pendientes de días anteriores» muestran lo activo; otro día o rango muestra todo (lo de ayer casi siempre ya está cerrado). */
function estadoPorDefectoDeRango(r: RangoPedidos): GrupoEstadoCaja {
  return r.modo === 'hoy' || r.modo === 'pendientes' ? 'act' : 'todos';
}

const ESTADO_OPCIONES = [
  { id: 'act', n: 'Activos' },
  { id: 'cer', n: 'Cerrados' },
  { id: 'todos', n: 'Todos (activos y cerrados)' },
  { id: 'noent', n: 'No entregados' },
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

/** Tarjetas por página según el ancho: 12 en PC (4 columnas), 8 en tablet, 6 en celular. */
function tarjetasPorPagina(): number {
  const w = typeof window === 'undefined' ? 1024 : window.innerWidth;
  return w >= 1280 ? 12 : w >= 700 ? 8 : 6;
}

function usePorPagina(): number {
  const [n, setN] = useState(tarjetasPorPagina);
  useEffect(() => {
    const f = () => setN(tarjetasPorPagina());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return n;
}

const Flecha = ({ der }: { der?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={der ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
  </svg>
);

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
  // Pedido abierto en la ventana de detalle (null = cerrada)
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(null);

  // Los cuatro filtros visibles y el grupo «Estado» del panel de Filtros
  const [filtro, setFiltro] = useState<FiltroCaja>('todo');
  const [grupoEstado, setGrupoEstado] = useState<GrupoEstadoCaja>('act');
  const [etapa, setEtapa] = useState<EtapaCaja>('all');

  const [busqueda, setBusqueda] = useState<string>('');
  const [fcOpen, setFcOpen] = useState<boolean>(false);
  const [masAbierto, setMasAbierto] = useState<boolean>(false);
  const [canalFiltro, setCanalFiltro] = useState<string>('all');
  const [modalidadFiltro, setModalidadFiltro] = useState<string>('all');
  const [cobroFiltro, setCobroFiltro] = useState<string>('all');

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const pedidosPorPagina = usePorPagina();

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
    // Ayer o un rango anterior: casi todo está entregado, así que se ve TODO (activos y cerrados); hoy y «pendientes» siguen con activos
    setGrupoEstado(estadoPorDefectoDeRango(nuevo));
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
    const pedidoUrl = idUrl ? pedidos.find((p) => String(p.id) === idUrl) : undefined;
    if (!pedidoUrl) return;
    // Un pedido cerrado vive en el grupo Cerrados; lo demás se ve en «Todo» (activos)
    if (esCerrado(pedidoUrl)) setGrupoEstado('cer');
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
    const q = busqueda.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (grupoEstado === 'cer' ? !esCerrado(p) : grupoEstado === 'act' && esCerrado(p)) return false;
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
      if (cobroFiltro !== 'all') {
        const pag = String(p.pago_estado).toUpperCase() === 'PAGADO';
        if (cobroFiltro === 'paid' && !pag) return false;
        if (cobroFiltro === 'unpaid' && pag) return false;
        if (cobroFiltro === 'sincaptura' && !p.cobroMozo?.sinCaptura) return false;
      }

      if (q) {
        const cod = String(p.codigo || '').toLowerCase();
        const cli = String(p.cliente_nombre || '').toLowerCase();
        // Por celular: se comparan solo dígitos (con o sin +51, espacios o guiones)
        const qDig = q.replace(/\D/g, '');
        const tel = String(p.cliente_telefono || '').replace(/\D/g, '');
        const porCelular = qDig.length >= 3 && tel.includes(qDig.replace(/^51(?=9\d{8}$)/, ''));
        if (!cod.includes(q) && !cli.includes(q) && !porCelular) return false;
      }

      return true;
    });
  }, [pedidos, grupoEstado, etapa, canalFiltro, modalidadFiltro, cobroFiltro, busqueda]);

  const conteos = useMemo(() => {
    const r = {} as Record<FiltroCaja, number>;
    for (const f of FILTROS_CAJA) r[f.id] = base.filter((p) => enFiltroCaja(p, f.id)).length;
    return r;
  }, [base]);

  const pedidosFiltrados = useMemo(() => base.filter((p) => enFiltroCaja(p, filtro)), [base, filtro]);

  // Atajos: lo que necesita atención no queda escondido
  const porConfirmar = useMemo(() => pedidos.filter(esPorConfirmar).length, [pedidos]);

  // Filtros activos del panel (chips removibles arriba)
  const hoy = hoyLima();
  const chips = useMemo(() => {
    const lista: { id: string; texto: string; quitar: () => void }[] = [];
    const estadoPorDefecto = estadoPorDefectoDeRango(rango);
    if (grupoEstado !== estadoPorDefecto) lista.push({ id: 'estado', texto: ESTADO_OPCIONES.find((e) => e.id === grupoEstado)!.n, quitar: () => cambiarGrupoEstado(estadoPorDefecto) });
    if (etapa !== 'all') lista.push({ id: 'etapa', texto: ETAPA_OPCIONES.find((e) => e.id === etapa)!.n, quitar: () => { setEtapa('all'); setPaginaActual(1); } });
    if (rango.modo !== 'hoy') lista.push({ id: 'dia', texto: textoRango(rango, hoy), quitar: () => cambiarRango(rangoHoy(hoy)) });
    if (canalFiltro !== 'all') lista.push({ id: 'canal', texto: `Canal: ${CANALES_OPCIONES.find((c) => c.id === canalFiltro)?.n}`, quitar: () => { setCanalFiltro('all'); setPaginaActual(1); } });
    if (modalidadFiltro !== 'all') lista.push({ id: 'mod', texto: `Modalidad: ${MODALIDADES_OPCIONES.find((m) => m.id === modalidadFiltro)?.n}`, quitar: () => { setModalidadFiltro('all'); setPaginaActual(1); } });
    if (cobroFiltro !== 'all') lista.push({ id: 'cobro', texto: `Cobro: ${COBRO_OPCIONES.find((c) => c.id === cobroFiltro)?.n}`, quitar: () => { setCobroFiltro('all'); setPaginaActual(1); } });
    return lista;
    // quitar usa solo setters estables; cambiarGrupoEstado/cambiarRango se recrean pero hacen lo mismo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoEstado, etapa, rango, canalFiltro, modalidadFiltro, cobroFiltro, hoy]);

  const limpiarFiltros = () => {
    setGrupoEstado('act');
    setEtapa('all');
    setCanalFiltro('all');
    setModalidadFiltro('all');
    setCobroFiltro('all');
    setBusqueda('');
    setFiltro('todo');
    setPaginaActual(1);
    cambiarRango(rangoHoy(hoy));
  };

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

  // Paginación fina: «1–12 de 18» con flechas
  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / pedidosPorPagina));
  const paginaValida = Math.min(paginaActual, totalPaginas);
  const pedidosPaginados = useMemo(() => {
    const inicio = (paginaValida - 1) * pedidosPorPagina;
    return pedidosFiltrados.slice(inicio, inicio + pedidosPorPagina);
  }, [pedidosFiltrados, paginaValida, pedidosPorPagina]);
  const desde = pedidosFiltrados.length === 0 ? 0 : (paginaValida - 1) * pedidosPorPagina + 1;
  const hasta = Math.min(paginaValida * pedidosPorPagina, pedidosFiltrados.length);

  const pedidoSeleccionado = useMemo(() => {
    return pedidos.find((p) => String(p.id) === pedidoSeleccionadoId) || null;
  }, [pedidos, pedidoSeleccionadoId]);

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

  const enNoEntregados = grupoEstado === 'noent';
  const totalNoEntregados = noEntregados?.total ?? 0;
  const puedeCortesia = tiene('cortesias/dar');

  return (
    <div className="cj2">
    {tiene('pedidos/cambiar_ubicacion') && <BandejaPropuestasUbicacion alAplicar={cargarDatos} />}
    {puedeValidarCobro && <PanelCambioCobro pendientes={cambiosCobro.pendientes} alResolver={() => { cambiosCobro.recargar(); cargarDatos(); }} />}

    {/* Cabecera compacta: caja cerrada e impresoras, atajos y acciones en una sola línea */}
    <div className="cj2-cab">
      <div className="cj-estado" style={{ margin: 0 }}>
        <BannerCajaCerrada compacto />
        <FranjaImpresion />
      </div>
      <span className="cj2-cab-vacio" />

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

      {puedeCortesia && (
        <button type="button" className="cj2-btn cj2-btn--cortesia-cab" onClick={() => setCortesiaSeparadaAbierta(true)}>
          Registrar cortesía
        </button>
      )}
      <AccesoListaEsperaCaja />
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

    {/* Los cuatro filtros visibles, buscador y panel de Filtros */}
    {!enNoEntregados && (
      <div className="cj2-fila" ref={filaFiltrosRef}>
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
        <button
          type="button"
          className="cj2-btn"
          onClick={() => setFcOpen(!fcOpen)}
          aria-expanded={fcOpen}
          style={{ background: fcOpen ? 'var(--cp-navy, #0B2C3E)' : undefined, color: fcOpen ? 'var(--cp-cream, #FBF4EC)' : undefined }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
          {chips.length > 0 && <span className="cj2-n-filtros">{chips.length}</span>}
        </button>

        {fcOpen && (
          <>
            <div className="cj2-panel-fondo" onClick={() => setFcOpen(false)} />
            <div className="cj2-panel" role="group" aria-label="Filtros">
              <div className="cj2-panel-cab">
                <span>Filtros</span>
                <button type="button" className="cj2-btn" onClick={() => setFcOpen(false)}>Listo</button>
              </div>
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
                  ]}
                  alCambiar={(v) => {
                    cambiarGrupoEstado(v as GrupoEstadoCaja);
                    if (v === 'noent') setFcOpen(false);
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
              {chips.length > 0 && (
                <button type="button" className="cj2-limpiar" style={{ alignSelf: 'flex-start' }} onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {/* Filtros activos: chips que se quitan con un toque */}
    {chips.length > 0 && (
      <div className="cj2-activos" aria-label="Filtros activos">
        {chips.map((c) => (
          <button key={c.id} type="button" className="cj2-quitar" aria-label={`Quitar filtro ${c.texto}`} onClick={c.quitar}>
            {c.texto} <span aria-hidden="true">×</span>
          </button>
        ))}
        <button type="button" className="cj2-limpiar" onClick={limpiarFiltros}>Limpiar filtros</button>
      </div>
    )}

    {enNoEntregados ? (
      <div className="cj-right cj2-noentregados">
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
      </div>
    ) : (
      <>
        {/* TARJETAS */}
        <div className="cj2-lista">
          {pedidosPaginados.length === 0 ? (
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
            <div className="cj2-cuadricula">
              {pedidosPaginados.map((o) => (
                <TarjetaPedidoCaja
                  key={o.id}
                  pedido={o}
                  seleccionado={pedidoSeleccionadoId === String(o.id)}
                  resaltado={pedidosResaltados.has(String(o.id))}
                  cajaCerradaEspera={esperaCajaCerrada(o, cajaAbierta)}
                  cambioCobroPendiente={cambiosCobro.pendientes.some((c) => c.pedidoId === String(o.id))}
                  alSeleccionar={(id) => setPedidoSeleccionadoId(String(id))}
                  accion={accionDe(o)}
                  alAccion={ejecutarAccion}
                />
              ))}
            </div>
          )}
        </div>

        {/* PAGINACIÓN FINA */}
        <div className="cj2-pag">
          <span className="cj2-pag-rango" data-testid="rango-pagina">
            {pedidosFiltrados.length === 0 ? '0 pedidos' : `${desde}–${hasta} de ${pedidosFiltrados.length}`}
          </span>
          <div className="cj2-pag-flechas">
            <button
              type="button"
              className="cj2-btn cj2-btn--ico"
              aria-label="Página anterior"
              disabled={paginaValida <= 1}
              onClick={() => setPaginaActual((p) => Math.max(1, Math.min(p, totalPaginas) - 1))}
            >
              <Flecha />
            </button>
            <span className="cj2-pag-n">{paginaValida}/{totalPaginas}</span>
            <button
              type="button"
              className="cj2-btn cj2-btn--ico"
              aria-label="Página siguiente"
              disabled={paginaValida >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, Math.min(p, totalPaginas) + 1))}
            >
              <Flecha der />
            </button>
          </div>
        </div>
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
