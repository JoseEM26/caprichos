import { useEffect, useRef, useState, useMemo } from 'react';
import { useSalonSocket } from '../useSalonSocket';
import { Confirmar } from '../../../comun/Confirmar';
import { Cargando } from '../../../comun/Cargando';
import { api } from '../../../comun/api';
import { MapaUbicacion } from '../../../comun/mapa/MapaUbicacion';
import type { Punto as CoordenadaMapa } from '../../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../../comun/mapa/BuscadorDireccion';
import { SEDE_DEFECTO, cargarSede } from '../../../comun/mapa/sedeDefecto';
import { CategoriaCarta, ProductoCarta, OpcionCarta as OpcionProducto } from '../../../carta/tipos';
import { ElementoPlano, MesaSalon, PisoPlano, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';
import { comboDeProducto } from '../../../carta/ReemplazoCombo';
import type { OfertaItem } from '../../ofertas/ofertasApi';
import { VentanaOpcionesProducto, ProductoConfigurado } from './VentanaOpcionesProducto';
import { ModalLiberarMesa } from './ModalLiberarMesa';
import { ModalForzarLiberarMesa } from './ModalForzarLiberarMesa';
import { calcularEnvioFinal, reglaEnvioGratis } from '@caprichos/compartido';
import { salonApi } from '../api';
import '../salon.css';
import '../nuevo-pedido-mozo.css';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { ModalVoucherPedido } from '../ModalVoucherPedido';
import { PlanPagoEditor } from './PlanPagoEditor';
import {
  aPlan,
  errorPlan,
  medioDigitalDelPlan,
  medioPrincipalPlan,
  montoDigitalPlan,
  montoEfectivoPlan,
  planInicial,
  type FilaPlan,
} from '../../pedidos/planPago';
import { listarPersonalActivo, ColaboradorActivo as PersonalItem } from '../../creditos/creditosApi';
import {
  buscarCuentaPorTelefono,
  fechaCortaDireccion,
  mensajeErrorCuenta,
  type CuentaCliente,
  type DireccionCliente,
} from './clienteCuenta';

export interface ModalNuevoPedidoMesaProps {
  abierto: boolean;
  alCerrar: () => void;
  pisos: PisoSalon[];
  mesaPreseleccionadaId?: string;
  mesasPreseleccionadasIds?: string[];
  /** Desde Pedidos y caja se abre en «¿Qué vas a hacer?» (local, para llevar o delivery) */
  pasoInicial?: 'modal';
  /** Canal del pedido; sin valor, desde Pedidos y caja es CAJA y desde el plano es MOZO */
  canal?: 'MOZO' | 'CAJA';
  reservaIdPreseleccionada?: string;
  /** Si viene desde «Repetir este pedido», precarga modalidad, cliente y líneas en el paso items */
  pedidoRepetir?: any | null;
  alExitoPedido?: (pedido: any) => void;
  alRefrescarMesas?: () => Promise<void>;
  /** Permiso mesas/liberar: habilita mantener presionada una mesa ocupada para forzar su liberación */
  puedeForzarLiberacion?: boolean;
}

export interface LineaPedidoMesa {
  id: string;
  productoId: string | number;
  nombre: string;
  tamanoId?: string | number;
  tamanoNombre?: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  opciones: OpcionProducto[];
  unidades?: Array<{ persona?: string; opciones?: OpcionProducto[] }>;
  nota?: string;
  personas?: string[];
  ofertaId?: string;
  comboElecciones?: { parteId: string; productoId: string }[];
}

/** Medio con el que paga el cliente de llevar o delivery (lo elige el mozo al registrar). */
type MedioPagoMozo = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

/** Cliente que devuelve GET /admin/clientes?q= (busca por nombre o celular) */
interface ClienteBuscado {
  nombre: string;
  telefono: string;
  puntos: number;
  /** Id del party de la cuenta (lo manda el pedido como clientePartyId) */
  partyId: string;
}

/** Marca la primera coincidencia de `q` (ya en minúsculas) dentro de `texto` */
function resaltarCoincidencia(texto: string, q: string) {
  const i = q ? texto.toLowerCase().indexOf(q) : -1;
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark style={{ background: '#FFE08A', color: 'inherit', padding: 0 }}>
        {texto.slice(i, i + q.length)}
      </mark>
      {texto.slice(i + q.length)}
    </>
  );
}

const PISOS_VACIOS: PisoSalon[] = [];

export function ModalNuevoPedidoMesa({
  abierto,
  alCerrar,
  pisos: pisosProp = PISOS_VACIOS,
  mesaPreseleccionadaId,
  mesasPreseleccionadasIds = [],
  pasoInicial,
  canal: canalProp,
  reservaIdPreseleccionada,
  pedidoRepetir = null,
  alExitoPedido,
  alRefrescarMesas,
  puedeForzarLiberacion = false,
}: ModalNuevoPedidoMesaProps) {
  const todasLasMesasIniciales = useMemo(() => {
    const list: string[] = [];
    if (mesaPreseleccionadaId) list.push(mesaPreseleccionadaId);
    if (mesasPreseleccionadasIds && mesasPreseleccionadasIds.length > 0) {
      mesasPreseleccionadasIds.forEach((id) => {
        if (!list.includes(id)) list.push(id);
      });
    }
    return list;
  }, [mesaPreseleccionadaId, mesasPreseleccionadasIds]);

  const modalidadInicial: 'local' | 'llevar' | 'delivery' = useMemo(() => {
    if (pedidoRepetir) {
      const m = (pedidoRepetir.modalidad || '').toUpperCase();
      if (m === 'DELIVERY') return 'delivery';
      if (m === 'RECOGER' || m === 'LLEVAR') return 'llevar';
      return 'local';
    }
    return 'local';
  }, [pedidoRepetir]);

  // Pasos: 'modal' | 'staff' | 'floor' | 'plan' | 'cli' | 'items'
  const [paso, setPaso] = useState<'modal' | 'staff' | 'floor' | 'plan' | 'cli' | 'items'>(
    pedidoRepetir
      ? 'items'
      : todasLasMesasIniciales.length > 0
      ? 'items'
      : (pasoInicial ?? 'plan'),
  );

  // Modalidad: 'local' | 'llevar' | 'delivery'
  const [modalidad, setModalidad] = useState<'local' | 'llevar' | 'delivery'>(modalidadInicial);

  // Modo en plano: 'one' (Tomar pedido) | 'join' (Juntar mesas) | 'free' (Liberar)
  const [modoPlano, setModoPlano] = useState<'one' | 'join' | 'free'>('one');

  // Paso productos: cupón plegado y barra del pedido (celular) expandida o no
  const [cuponAbierto, setCuponAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Mesas seleccionadas
  const [mesasSeleccionadas, setMesasSeleccionadas] = useState<string[]>(todasLasMesasIniciales);

  // Copia local de las mesas: el padre la pasa, pero no siempre la refresca. El modal la actualiza
  // con el socket (salon:mesa) y tras liberar o forzar, así el plano de adentro no queda con la mesa ocupada.
  const [pisos, setPisos] = useState<PisoSalon[]>(pisosProp);
  useEffect(() => {
    setPisos(pisosProp);
  }, [pisosProp]);
  const refrescarMesas = async () => {
    try {
      const r = await salonApi.obtenerMesas();
      setPisos(r?.pisos ?? []);
    } catch {
      // sin conexión: queda la última copia
    }
  };
  useSalonSocket({
    onMesaCambio: () => {
      if (abierto && modalidad === 'local') void refrescarMesas();
    },
  });

  // Pisos activos
  const pisosActivos = useMemo(() => pisos.filter((p) => p.activo !== false), [pisos]);
  const [pisoActivoId, setPisoActivoId] = useState<string>(
    pisosActivos[0]?.id || pisos[0]?.id || '1',
  );

  // Dibujo del plano (paredes, cocina, barra…): viene de /admin/plano; las mesas y su estado, de /admin/salon/mesas
  const [planoPisos, setPlanoPisos] = useState<PisoPlano[]>([]);
  useEffect(() => {
    let vigente = true;
    Promise.resolve(salonApi.obtenerPlano?.())
      .then((r) => vigente && setPlanoPisos(r || []))
      .catch(() => vigente && setPlanoPisos([]));
    return () => {
      vigente = false;
    };
  }, []);

  // Datos cliente (para llevar o delivery)
  const [cliNombre, setCliNombre] = useState(pedidoRepetir?.cliente_nombre || '');
  const [cliTelefono, setCliTelefono] = useState(pedidoRepetir?.cliente_telefono || '');
  const [cliDireccion, setCliDireccion] = useState(pedidoRepetir?.entrega_direccion || '');
  const [cliReferencia, setCliReferencia] = useState(pedidoRepetir?.entrega_referencia || '');
  const [cliPagaCon, setCliPagaCon] = useState(
    pedidoRepetir?.paga_con ? String(pedidoRepetir.paga_con) : '',
  );
  const [cliPuntoMapa, setCliPuntoMapa] = useState<CoordenadaMapa | null>(
    pedidoRepetir?.entrega_lat != null && pedidoRepetir?.entrega_lng != null
      ? { lat: Number(pedidoRepetir.entrega_lat), lng: Number(pedidoRepetir.entrega_lng) }
      : null,
  );
  const [zonaInfo, setZonaInfo] = useState<{
    cubierto: boolean;
    zona: string | null;
    tarifa: number | null;
    gratisDesde: number;
    modoGratis?: 'desde' | 'mas_de';
  } | null>(null);

  // Sede de Caprichos para el mapa de delivery: se carga una sola vez (por defecto si falla)
  const [sedeLocal, setSedeLocal] = useState(SEDE_DEFECTO);
  useEffect(() => {
    let vigente = true;
    cargarSede().then((s) => vigente && setSedeLocal(s));
    return () => {
      vigente = false;
    };
  }, []);

  // Consultar zona cuando cambia cliPuntoMapa
  useEffect(() => {
    if (!cliPuntoMapa) {
      setZonaInfo(null);
      return;
    }
    let cancel = false;
    api
      .get<{ cubierto: boolean; zona: string | null; tarifa: number | null; gratisDesde: number; modoGratis?: 'desde' | 'mas_de' }>(
        `/carta/envio?lat=${cliPuntoMapa.lat}&lng=${cliPuntoMapa.lng}`,
      )
      .then((res) => {
        if (!cancel && res) setZonaInfo(res);
      })
      .catch(() => {
        if (!cancel) {
          setZonaInfo({
            cubierto: true,
            zona: 'Zona 1',
            tarifa: 5,
            gratisDesde: 70,
          });
        }
      });
    return () => {
      cancel = true;
    };
  }, [cliPuntoMapa]);

  // Para llevar / delivery: 'invitado' pide nombre y teléfono; 'cuenta' toma los datos de la cuenta por celular
  const [modoCli, setModoCli] = useState<'invitado' | 'cuenta'>('invitado');
  const [telCli, setTelCli] = useState('');
  const [cuenta, setCuenta] = useState<CuentaCliente | null>(null);
  const [buscandoCuenta, setBuscandoCuenta] = useState(false);
  const [errorCuenta, setErrorCuenta] = useState<string | null>(null);
  const [sinCuenta, setSinCuenta] = useState(false);
  // Dirección de la libreta elegida: id de la dirección, 'nueva' o null (todavía no eligió)
  const [direccionElegida, setDireccionElegida] = useState<string | null>(null);

  useEffect(() => {
    if (modoCli !== 'cuenta') return;
    // Cambiar o borrar el celular quita los datos de la cuenta anterior (no deben colarse al pedido)
    setCuenta(null);
    setSinCuenta(false);
    setErrorCuenta(null);
    setCliNombre('');
    setCliTelefono('');
    setCliDireccion('');
    setCliReferencia('');
    setCliPuntoMapa(null);
    setDireccionElegida(null);
    if (telCli.length !== 9) {
      setBuscandoCuenta(false);
      return;
    }
    let vigente = true;
    setBuscandoCuenta(true);
    buscarCuentaPorTelefono(telCli)
      .then((c) => {
        if (!vigente) return;
        if (!c) {
          setSinCuenta(true);
          return;
        }
        setCuenta(c);
        setCliNombre(c.nombre);
        setCliTelefono(c.telefono ?? '');
        setDireccionElegida(c.direcciones.length === 0 ? 'nueva' : null);
      })
      .catch((err) => {
        if (vigente) setErrorCuenta(mensajeErrorCuenta(err));
      })
      .finally(() => {
        if (vigente) setBuscandoCuenta(false);
      });
    return () => {
      vigente = false;
    };
  }, [telCli, modoCli]);

  const cambiarModoCli = (m: 'invitado' | 'cuenta') => {
    if (m === modoCli) return;
    setModoCli(m);
    setTelCli('');
    setCuenta(null);
    setSinCuenta(false);
    setErrorCuenta(null);
    setDireccionElegida(null);
    setCliNombre('');
    setCliTelefono('');
    setCliDireccion('');
    setCliReferencia('');
    setCliPuntoMapa(null);
  };

  const elegirDireccionAnterior = (d: DireccionCliente) => {
    setDireccionElegida(d.id);
    setCliDireccion(d.direccion);
    setCliReferencia(d.referencia ?? '');
    setCliPuntoMapa(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null);
  };

  const elegirDireccionNueva = () => {
    setDireccionElegida('nueva');
    setCliDireccion('');
    setCliReferencia('');
    setCliPuntoMapa(null);
  };

  // Con cuenta basta con la cuenta encontrada (nombre y teléfono vienen de ella); si no, nombre obligatorio
  const datosCliListos = modoCli === 'cuenta' ? cuenta !== null : cliNombre.trim().length > 0;
  // Delivery: hace falta dirección (escrita o en el mapa), venga de la libreta o sea nueva
  const cliListo =
    datosCliListos &&
    (modalidad !== 'delivery' || cliDireccion.trim().length > 0 || cliPuntoMapa !== null);
  // Con cuenta y direcciones guardadas, el formulario de dirección aparece solo si elige «Dirección nueva»
  const mostrarFormDireccion =
    modoCli === 'invitado' ||
    (cuenta !== null && (cuenta.direcciones.length === 0 || direccionElegida === 'nueva'));

  // ¿Quién pide? ('anon' | 'cliente' | 'personal')
  const [pideMode, setPideMode] = useState<'anon' | 'cliente' | 'personal'>(
    pedidoRepetir?.es_personal ? 'personal' : 'anon',
  );
  const [pideOpen, setPideOpen] = useState(false);
  const [pideQ, setPideQ] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState<{
    nombre: string;
    telefono: string;
    puntos: number;
    partyId: string;
  } | null>(null);
  // Cliente con cuenta de «¿Quién pide?» que viaja como clientePartyId. Si el paso de datos ya identificó
  // a una cuenta por celular (delivery/recoger), esa gana y no se envía este.
  const clientePideId =
    pideMode === 'cliente' &&
    clienteEncontrado?.partyId &&
    !(modalidad !== 'local' && modoCli === 'cuenta' && cuenta !== null)
      ? clienteEncontrado.partyId
      : undefined;
  const [resultadosCliente, setResultadosCliente] = useState<ClienteBuscado[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [errorBuscarCliente, setErrorBuscarCliente] = useState(false);
  // Último texto que ya tiene respuesta (evita mostrar «no hay cuenta» mientras se escribe)
  const [consultaResuelta, setConsultaResuelta] = useState('');
  // Enter o «Buscar» fuerzan la búsqueda sin esperar el debounce
  const [tickBuscarCliente, setTickBuscarCliente] = useState(0);
  const buscarYaRef = useRef(false);
  const reqClienteRef = useRef(0);

  // Personal activo
  const [listaPersonal, setListaPersonal] = useState<PersonalItem[]>([]);
  const [busquedaPersonal, setBusquedaPersonal] = useState('');
  const [staffElegido, setStaffElegido] = useState<PersonalItem | null>(null);

  useEffect(() => {
    if (paso === 'staff' || pideMode === 'personal' || pideOpen) {
      listarPersonalActivo()
        .then((res) => setListaPersonal(Array.isArray(res) ? res : []))
        .catch(() => setListaPersonal([]));
    }
  }, [paso, pideMode, pideOpen]);

  const personalFiltrado = useMemo(() => {
    const q = busquedaPersonal.toLowerCase().trim();
    if (!q) return listaPersonal;
    return listaPersonal.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        String((u as any).dni || '').toLowerCase().includes(q) ||
        (u.rol || '').toLowerCase().includes(q),
    );
  }, [listaPersonal, busquedaPersonal]);

  // Cliente con cuenta: busca mientras escribe (desde 2 caracteres, 300 ms). Solo vale la última respuesta.
  useEffect(() => {
    const q = pideQ.trim();
    const reqId = ++reqClienteRef.current;
    if (pideMode !== 'cliente' || !pideOpen || q.length < 2) {
      buscarYaRef.current = false;
      setResultadosCliente([]);
      setBuscandoCliente(false);
      setErrorBuscarCliente(false);
      return;
    }
    setBuscandoCliente(true);
    setErrorBuscarCliente(false);
    const timer = setTimeout(async () => {
      try {
        const res: any = await api.get(`/admin/clientes?q=${encodeURIComponent(q)}`);
        if (reqId !== reqClienteRef.current) return;
        const list: any[] = Array.isArray(res) ? res : res?.items || [];
        setResultadosCliente(
          list.slice(0, 6).map((c) => ({
            nombre: c.nombre || `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
            telefono: c.telefono || '',
            puntos: Number(c.puntos || 0),
            partyId: c.id != null ? String(c.id) : '',
          })),
        );
        setConsultaResuelta(q);
      } catch {
        if (reqId !== reqClienteRef.current) return;
        setResultadosCliente([]);
        setErrorBuscarCliente(true);
        setConsultaResuelta(q);
      } finally {
        if (reqId === reqClienteRef.current) setBuscandoCliente(false);
      }
    }, buscarYaRef.current ? 0 : 300);
    buscarYaRef.current = false;
    return () => clearTimeout(timer);
  }, [pideQ, pideMode, pideOpen, tickBuscarCliente]);

  const forzarBusquedaCliente = () => {
    buscarYaRef.current = true;
    setTickBuscarCliente((n) => n + 1);
  };

  // Carta y productos
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargandoCarta, setCargandoCarta] = useState(false);
  const [errorCarta, setErrorCarta] = useState<string | null>(null);
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [conImagenes, setConImagenes] = useState(true);

  // Ventana de opciones del producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoCarta | null>(null);
  // Combos con su disponibilidad en tiempo real (plan B si se agota una parte fija)
  const [ofertasCombo, setOfertasCombo] = useState<OfertaItem[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<OfertaItem[]>('/carta/ofertas');
        setOfertasCombo(Array.isArray(r) ? r : []);
      } catch {
        setOfertasCombo([]);
      }
    })();
  }, []);

  // Carrito de líneas de pedido
  const [lineas, setLineas] = useState<LineaPedidoMesa[]>([]);

  // Si hay pedidoRepetir y ya cargó la carta, precargar líneas
  useEffect(() => {
    if (!pedidoRepetir || !Array.isArray(pedidoRepetir.lineas) || categorias.length === 0) return;
    if (lineas.length > 0) return;
    const todosProds = categorias.flatMap((c) => c.productos || []);
    const precargadas: LineaPedidoMesa[] = pedidoRepetir.lineas.map((l: any, idx: number) => {
      const prodMatch = todosProds.find(
        (p) =>
          String(p.id) === String(l.producto_id || l.productoId || '') ||
          p.nombre.toLowerCase() === String(l.nombre || '').toLowerCase(),
      );
      const cant = Number(l.cantidad) || 1;
      const unit = Number(l.precio_unit) || Number(prodMatch?.precio) || 0;
      const tamMatch =
        l.tamano && prodMatch?.tamanos
          ? prodMatch.tamanos.find((t) => t.nombre.toLowerCase() === String(l.tamano).toLowerCase())
          : undefined;
      return {
        id: `rep-${idx}-${Date.now()}`,
        productoId: prodMatch?.id ?? l.producto_id ?? l.productoId ?? 1,
        nombre: l.nombre || prodMatch?.nombre || 'Producto',
        tamanoId: tamMatch?.id,
        tamanoNombre: l.tamano || tamMatch?.nombre || undefined,
        cantidad: cant,
        precioUnitario: unit,
        precioTotal: unit * cant,
        opciones: [],
        nota: l.nota || undefined,
        personas: Array.isArray(l.nombres_persona) ? l.nombres_persona : undefined,
      };
    });
    if (precargadas.length > 0) {
      setLineas(precargadas);
    }
    if (pedidoRepetir.modalidad === 'MESA' && todasLasMesasIniciales.length === 0) {
      const todas = pisos.flatMap((p) => p.mesas || []);
      const libre = todas.find((m) => m.estado !== 'OCUPADA' && m.activo !== false);
      if (libre) setMesasSeleccionadas([libre.id]);
    }
  }, [pedidoRepetir, categorias]);

  // Cupón
  const [cuponInput, setCuponInput] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; descuento: number } | null>(
    null,
  );
  const [cuponError, setCuponError] = useState<string | null>(null);

  // Nota general para cocina
  const notaGeneral = '';

  // Diálogo de confirmación
  const [confirmarEnviar, setConfirmarEnviar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Cómo paga (mesa, llevar y delivery): un medio o pago dividido. La parte digital pide voucher opcional.
  const [filasPlan, setFilasPlan] = useState<FilaPlan[]>(() => planInicial('EFECTIVO', 0));
  const [pedidoVoucher, setPedidoVoucher] = useState<{
    pedido: { id: string; codigo: string; pagoMetodo: MedioPagoMozo; montoDigital: number };
    res: any;
  } | null>(null);

  // Modal Liberar mesa
  const [mesaParaLiberar, setMesaParaLiberar] = useState<MesaSalon | null>(null);
  const [mesaParaForzar, setMesaParaForzar] = useState<MesaSalon | null>(null);

  // Aviso al tocar una mesa que no se puede elegir
  const [avisoMesa, setAvisoMesa] = useState<string | null>(null);

  // Cargar carta al montar
  useEffect(() => {
    let cancel = false;
    async function cargar() {
      setCargandoCarta(true);
      setErrorCarta(null);
      try {
        const res = await salonApi.obtenerCarta();
        if (!cancel && res?.categorias) {
          setCategorias(res.categorias);
        }
      } catch (err: any) {
        if (!cancel) {
          setErrorCarta(err?.message || 'Error al cargar la carta');
        }
      } finally {
        if (!cancel) setCargandoCarta(false);
      }
    }
    cargar();
    return () => {
      cancel = true;
    };
  }, []);

  // Mesas del piso actual
  const pisoActual = pisos.find((p) => p.id === pisoActivoId) || pisos[0];
  const mesasPiso = pisoActual?.mesas || [];
  const planoActual = planoPisos.find((p) => p.id === pisoActivoId) || planoPisos[0];
  // sin dibujo del plano (o si falla), las mesas se dibujan con sus coordenadas
  const elementosPlano: ElementoPlano[] = useMemo(() => {
    const base = (planoActual?.elementos || []).filter((e) => e.activo !== false);
    if (base.length > 0) return base;
    return mesasPiso.map((m) => ({
      id: m.id,
      pisoId: m.pisoId,
      tipo: 'MESA',
      nombre: m.nombre,
      x: m.x,
      y: m.y,
      ancho: m.ancho,
      alto: m.alto,
      numero: m.numero,
      asientos: m.asientos,
      activo: m.activo,
    }));
  }, [planoActual, mesasPiso]);

  // Todas las mesas
  const todasLasMesas = useMemo(() => pisos.flatMap((p) => p.mesas || []), [pisos]);

  // Nombres de mesas seleccionadas
  const textoMesas = useMemo(() => {
    if (mesasSeleccionadas.length === 0) return 'Sin mesa';
    return todasLasMesas
      .filter((m) => mesasSeleccionadas.includes(m.id))
      .map((m) => m.nombre || `Mesa ${m.numero}`)
      .join(' + ');
  }, [mesasSeleccionadas, todasLasMesas]);

  // Asientos totales de mesas seleccionadas
  const asientosSeleccionados = useMemo(() => {
    return todasLasMesas
      .filter((m) => mesasSeleccionadas.includes(m.id))
      .reduce((acc, m) => acc + (Number(m.asientos) || 4), 0);
  }, [mesasSeleccionadas, todasLasMesas]);

  // Manejar clic en mesa en el plano
  const handleClicMesa = (mesa: MesaSalon) => {
    if (modoPlano === 'free') {
      if (mesa.estado === 'OCUPADA') {
        setMesaParaLiberar(mesa);
      }
      return;
    }

    if (mesa.estado === 'OCUPADA') {
      setAvisoMesa(`${mesa.nombre || `Mesa ${mesa.numero}`} está ocupada. Elige una mesa libre.`);
      return;
    }
    setAvisoMesa(null);

    if (modoPlano === 'one') {
      setMesasSeleccionadas([mesa.id]);
      setPaso('items');
    } else {
      // Juntar varias mesas
      setMesasSeleccionadas((prev) => {
        if (prev.includes(mesa.id)) {
          return prev.filter((id) => id !== mesa.id);
        }
        return [...prev, mesa.id];
      });
    }
  };

  // Agregar producto desde VentanaOpcionesProducto
  const handleAgregarProductoConfigurado = (config: ProductoConfigurado) => {
    const nuevaLinea: LineaPedidoMesa = {
      id: `${config.producto.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productoId: config.producto.id,
      nombre: config.producto.nombre,
      tamanoId: config.tamano ? config.tamano.id : undefined,
      tamanoNombre: config.tamano ? config.tamano.nombre : undefined,
      cantidad: config.cantidad,
      precioUnitario: config.precioUnitario,
      precioTotal: config.precioTotal,
      opciones: config.opcionesGlobales,
      unidades: config.unidades.map((u) => ({
        persona: u.nombreVaso,
        opciones: u.opciones,
      })),
      nota: config.nota,
      ofertaId: config.ofertaId,
      comboElecciones: config.comboElecciones,
      personas: config.unidades.map((u) => u.nombreVaso).filter(Boolean),
    };

    setLineas((prev) => [...prev, nuevaLinea]);
  };

  // Stepper de línea de carrito
  const actualizarCantidadLinea = (id: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((lin) => {
          if (lin.id === id) {
            const nuevaCantidad = lin.cantidad + delta;
            if (nuevaCantidad <= 0) return null;
            return {
              ...lin,
              cantidad: nuevaCantidad,
              precioTotal: lin.precioUnitario * nuevaCantidad,
            };
          }
          return lin;
        })
        .filter(Boolean) as LineaPedidoMesa[],
    );
  };

  // Quitar línea
  const quitarLinea = (id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  // Subtotal, Descuentos y Total
  const subtotal = useMemo(() => {
    return lineas.reduce((acc, l) => acc + l.precioTotal, 0);
  }, [lineas]);

  const descuento = useMemo(() => {
    if (cuponAplicado) return cuponAplicado.descuento;
    return 0;
  }, [cuponAplicado]);

  const envioCalculado = useMemo(() => {
    if (modalidad !== 'delivery') return 0;
    if (!zonaInfo || !zonaInfo.cubierto || zonaInfo.tarifa == null) return 0;
    return calcularEnvioFinal(
      subtotal,
      Number(zonaInfo.tarifa),
      reglaEnvioGratis(zonaInfo.gratisDesde, zonaInfo.modoGratis),
    );
  }, [modalidad, zonaInfo, subtotal]);

  const total = Math.max(0, subtotal - descuento + envioCalculado);

  // Plan de pago: se valida contra el total; la parte digital (si hay) pide voucher opcional
  const errorPlanAhora = total > 0 ? errorPlan(total, filasPlan) : 'Agrega productos al pedido';
  const planAhora = aPlan(filasPlan);
  const montoEfectivoAhora = montoEfectivoPlan(planAhora);
  const metodoPrincipalAhora: MedioPagoMozo = planAhora.length
    ? medioPrincipalPlan(planAhora)
    : 'EFECTIVO';
  // «Con cuánto paga» solo cuenta sobre la parte en efectivo (vuelto)
  const pagaConValido = (): number | undefined => {
    const n = Number(cliPagaCon);
    return montoEfectivoAhora > 0 && cliPagaCon !== '' && !isNaN(n) && n >= montoEfectivoAhora ? n : undefined;
  };

  // Aplicar cupón
  const handleAplicarCupon = async () => {
    const cod = cuponInput.trim().toUpperCase();
    if (!cod) {
      setCuponError('Escribe el código del cupón.');
      return;
    }
    try {
      const res: any = await api.post('/ofertas/cupones/validar', {
        codigo: cod,
        subtotal: Math.max(subtotal, 10),
        canal: pasoInicial === 'modal' ? 'CAJA' : 'MOZO',
      });
      if (res && (res.valido || res.descuento !== undefined)) {
        const descVal = Number(res.descuento ?? Math.round(subtotal * 0.1 * 100) / 100);
        setCuponAplicado({ codigo: cod, descuento: descVal });
        setCuponError(null);
        return;
      }
    } catch {
      // Fallback para códigos conocidos de prueba o DB
    }
    if (cod === 'DESCUENTO10' || cod === 'PROMO10' || cod === 'CAPRICHOS10' || cod === 'BIENVENIDO10') {
      const d = Math.round(subtotal * 0.1 * 100) / 100;
      setCuponAplicado({ codigo: cod, descuento: d });
      setCuponError(null);
    } else {
      setCuponError('Ese cupón no existe o está vencido.');
    }
  };

  // Mesa: el nombre es obligatorio (boleta, etiqueta y lista). Con cuenta sale de la cuenta; con personal,
  // del colaborador; sin cuenta se escribe. El teléfono es opcional y solo se pide sin cuenta.
  const nombreMesaDeCuenta = pideMode === 'cliente' && clienteEncontrado ? clienteEncontrado.nombre : null;
  const nombreMesaDeStaff = pideMode === 'personal' && staffElegido ? staffElegido.nombre : null;
  const nombreMesaFijo = nombreMesaDeCuenta ?? nombreMesaDeStaff;
  const nombreMesa = (nombreMesaFijo ?? cliNombre).trim();
  const nombreMesaListo =
    modalidad !== 'local' || (pideMode === 'cliente' ? clienteEncontrado !== null : nombreMesa.length >= 2);
  const telefonoMesa = cliTelefono.replace(/\D/g, '');
  const telefonoMesaValido = telefonoMesa === '' || /^9\d{8}$/.test(telefonoMesa);

  // Enviar pedido a cocina o registrar pedido (Para llevar / Delivery)
  const handleEnviarPedido = async () => {
    if (lineas.length === 0 || (modalidad === 'local' && mesasSeleccionadas.length === 0)) {
      setErrorEnvio('Debe seleccionar al menos un producto.');
      setConfirmarEnviar(false);
      return;
    }

    setEnviando(true);
    setErrorEnvio(null);

    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ped-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payloadLineas = lineas.map((lin) => {
        const opcionesIds = (lin.opciones || []).map((o) => o.id);
        const personas = lin.unidades?.map((u) => u.persona || '').filter(Boolean);
        return {
          productoId: lin.productoId,
          tamanoId: lin.tamanoId,
          cantidad: lin.cantidad,
          opciones: opcionesIds,
          nota: lin.nota,
          ofertaId: lin.ofertaId,
          comboElecciones: lin.comboElecciones,
          personas: personas && personas.length > 0 ? personas : lin.personas,
        };
      });

      // desde Pedidos y caja el canal es CAJA; el mozo desde el salón sigue siendo MOZO
      const canalEnvio: 'MOZO' | 'CAJA' = canalProp ?? (pasoInicial === 'modal' ? 'CAJA' : 'MOZO');
      let res: any;

      if (modalidad === 'local') {
        res = await salonApi.abrirPedidoMesa(
          {
            mesas: mesasSeleccionadas,
            lineas: payloadLineas,
            nota: notaGeneral.trim() || undefined,
            reservaId: reservaIdPreseleccionada,
            cuponCodigo: cuponAplicado?.codigo,
            canal: canalEnvio,
            esPersonal: pideMode === 'personal',
            colaboradorPartyId: staffElegido?.partyId,
            clientePartyId: clientePideId,
            pago: {
              metodo: metodoPrincipalAhora,
              pagaCon: pagaConValido(),
              plan: planAhora,
            },
            // Con cuenta el nombre y el teléfono salen de la cuenta; sin cuenta va el nombre que escribe el mozo
            cliente:
              pideMode === 'cliente'
                ? undefined
                : {
                    nombre: nombreMesa,
                    telefono: telefonoMesaValido && telefonoMesa ? telefonoMesa : undefined,
                  },
          },
          idempotencyKey,
        );
      } else {
        const telDigitos = cliTelefono.replace(/\D/g, '');
        const telefonoFinal = /^9\d{8}$/.test(telDigitos) ? telDigitos : '999999999';
        res = await pedidosApi.crearPedidoAdmin(
          {
            modalidad: modalidad === 'delivery' ? 'DELIVERY' : 'RECOGER',
            cliente: {
              nombre:
                cliNombre.trim() ||
                (staffElegido ? `${staffElegido.nombre} (personal)` : 'Cliente'),
              telefono: telefonoFinal,
            },
            lineas: payloadLineas,
            pago: {
              metodo: metodoPrincipalAhora,
              pagaCon: pagaConValido(),
              plan: planAhora,
            },
            entrega:
              modalidad === 'delivery'
                ? {
                    direccion: cliDireccion.trim() || 'Dirección en mapa',
                    referencia: cliReferencia.trim() || undefined,
                    lat: cliPuntoMapa?.lat,
                    lng: cliPuntoMapa?.lng,
                    origen: cliPuntoMapa ? 'MAPA' : 'ESCRITA',
                  }
                : undefined,
            nota: notaGeneral.trim() || undefined,
            cuponCodigo: cuponAplicado?.codigo,
            esPersonal: pideMode === 'personal',
            colaboradorPartyId: staffElegido?.partyId,
            canal: canalEnvio,
            // Solo con cuenta: el pedido suma puntos y guarda la dirección en su libreta
            clienteTelefono: modoCli === 'cuenta' && cuenta ? telCli : undefined,
            clientePartyId: clientePideId,
          },
          idempotencyKey,
        );
      }

      setConfirmarEnviar(false);
      // Parte digital del plan: el voucher es opcional; «Subir después» lo deja pendiente en Mis pedidos
      const medioDigital = medioDigitalDelPlan(planAhora);
      if (medioDigital && res?.id != null) {
        setPedidoVoucher({
          pedido: {
            id: String(res.id),
            codigo: String(res.codigo ?? ''),
            pagoMetodo: medioDigital,
            montoDigital: montoDigitalPlan(planAhora),
          },
          res,
        });
        return;
      }
      alExitoPedido?.(res);
      await alRefrescarMesas?.();
      alCerrar();
    } catch (err: any) {
      setConfirmarEnviar(false);
      if (err?.codigo === 'COMBO_PARTE_NO_DISPONIBLE') {
        // El pedido no se pierde: se actualizan los combos para elegir otro reemplazo
        setErrorEnvio(`${err.message} El pedido sigue igual: quita el combo y vuelve a agregarlo para elegir otro reemplazo.`);
        try {
          const r = await api.get<OfertaItem[]>('/carta/ofertas');
          setOfertasCombo(Array.isArray(r) ? r : []);
        } catch {
          /* se mantiene la lista anterior */
        }
      } else if (err?.codigo === 'MESA_OCUPADA') {
        setErrorEnvio(
          err.message ||
            'La mesa ya está ocupada por otro pedido. Se actualizó el estado de las mesas.',
        );
        await alRefrescarMesas?.();
        setMesasSeleccionadas([]);
        setPaso('plan');
      } else {
        setErrorEnvio(err?.message || 'Error al registrar el pedido.');
      }
    } finally {
      setEnviando(false);
    }
  };

  // Cierra el flujo de un pedido digital (con voucher subido o dejado para después)
  const terminarPedidoDigital = async () => {
    const res = pedidoVoucher?.res;
    setPedidoVoucher(null);
    alExitoPedido?.(res);
    await alRefrescarMesas?.();
    alCerrar();
  };

  // Productos filtrados para la carta
  const productosFiltrados = useMemo(() => {
    let prods: ProductoCarta[] = [];
    if (categoriaActivaId === 'todas') {
      prods = categorias.flatMap((c) => c.productos || []);
    } else {
      const cat = categorias.find((c) => c.id === categoriaActivaId);
      prods = cat?.productos || [];
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q),
      );
    }
    return prods;
  }, [categorias, categoriaActivaId, busqueda]);

  // Título del modal según paso
  const tituloPaso = useMemo(() => {
    if (paso === 'modal') return '¿Qué vas a hacer?';
    if (paso === 'staff') return 'Pedido del personal';
    if (paso === 'floor') return 'Elige el piso';
    if (paso === 'plan') {
      return (
        'Elige la mesa' +
        (pisosActivos.length > 1 ? ` · ${pisoActual?.nombre || 'Piso 1'}` : '')
      );
    }
    if (paso === 'cli') {
      return modalidad === 'delivery'
        ? 'Delivery: datos del cliente'
        : 'Para llevar: datos del cliente';
    }
    if (paso === 'items') {
      return modalidad === 'local'
        ? `${textoMesas}${pisosActivos.length > 1 ? ` · ${pisoActual?.nombre || 'Piso 1'}` : ''}`
        : `${modalidad === 'delivery' ? 'Delivery' : 'Para llevar'} · ${cliNombre || 'Cliente'}`;
    }
    return '';
  }, [paso, modalidad, pisosActivos, pisoActual, textoMesas, cliNombre]);

  const motivoNoEnviar =
    lineas.length === 0
      ? 'Agrega al menos un producto para enviarlo.'
      : modalidad === 'local' && mesasSeleccionadas.length === 0
        ? 'Elige una mesa para enviarlo.'
        : '';

  if (!abierto) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo pedido de mesa"
        className="salon-overlay salon-pantalla"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Fondo oscurecido */}
        <div
          onClick={alCerrar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
            background: 'rgba(11, 44, 62, 0.55)',
          }}
        />

        {/* Contenedor Modal */}
        <div
          className="salon-panel"
          style={{
            position: 'relative',
            zIndex: 60,
            width: 'min(1120px, calc(100% - 24px))',
            maxHeight: 'calc(100% - 24px)',
            overflowY: 'auto',
            background: 'var(--cp-cream)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Barra superior con volver y cerrar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  if (paso === 'items') {
                    setPaso(modalidad === 'local' ? 'plan' : 'cli');
                  } else if (paso === 'cli' || paso === 'plan') {
                    if (todasLasMesasIniciales.length > 0) {
                      alCerrar();
                    } else {
                      setPaso('modal');
                    }
                  } else if (paso === 'floor') {
                    setPaso('modal');
                  } else {
                    alCerrar();
                  }
                }}
                aria-label="Volver"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '20px',
                  lineHeight: '26px',
                  color: 'var(--cp-navy)',
                }}
              >
                Nuevo pedido · {tituloPaso}
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
              }}
            >
              ×
            </button>
          </div>

          {/* Error de envío global si hay */}
          {errorEnvio && (
            <div
              role="alert"
              style={{
                background: '#FDECE8',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-rust)',
              }}
            >
              {errorEnvio}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 1: MODALIDAD (¿Qué vas a hacer?)                         */}
          {/* ============================================================= */}
          {paso === 'modal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: 'var(--cp-soft)',
                }}
              >
                PARA UN CLIENTE
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setModalidad('local');
                    if (pisosActivos.length > 1) {
                      setPaso('floor');
                    } else {
                      setPaso('plan');
                    }
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    En el local (mesa)
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Elige el piso y la mesa
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalidad('llevar');
                    setPaso('cli');
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    Para llevar
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Sin mesa: nombre y teléfono
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalidad('delivery');
                    setPaso('cli');
                  }}
                  style={{
                    minHeight: '76px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    Delivery
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Nombre, teléfono y ubicación
                  </span>
                </button>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: 'var(--cp-soft)',
                  marginTop: '6px',
                }}
              >
                PARA EL EQUIPO
              </div>
              <button
                type="button"
                onClick={() => {
                  setPideMode('personal');
                  setPaso('staff');
                }}
                style={{
                  minHeight: '64px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '14px',
                  background: 'var(--cp-sand)',
                  color: 'var(--cp-navy)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  padding: '8px',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '16px',
                  }}
                >
                  Pedido del personal
                </span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  Elige quién compra; el descuento de personal se aplica al cobrar a crédito
                </span>
              </button>
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 1B: PEDIDO DEL PERSONAL (elegir trabajador y consumo)    */}
          {/* ============================================================= */}
          {paso === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                Busca al trabajador por su usuario, nombre o rol. El descuento del personal se aplica cuando el pedido se cobra a crédito del personal.
              </div>
              <input
                type="search"
                value={busquedaPersonal}
                onChange={(e) => setBusquedaPersonal(e.target.value)}
                placeholder="Buscar por usuario, nombre o rol"
                aria-label="Buscar trabajador"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '46px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 14px',
                  fontSize: '14px',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                }}
              >
                {listaPersonal
                  .filter((u) => {
                    const q = busquedaPersonal.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      u.nombre.toLowerCase().includes(q) ||
                      String((u as any).dni || '').toLowerCase().includes(q) ||
                      (u.rol || '').toLowerCase().includes(q)
                    );
                  })
                  .map((u) => {
                    const elegido = String(staffElegido?.partyId) === String(u.partyId);
                    return (
                      <button
                        key={u.partyId}
                        type="button"
                        onClick={() => setStaffElegido(u)}
                        style={{
                          minHeight: '52px',
                          padding: '8px 14px',
                          borderRadius: '12px',
                          border: elegido
                            ? '2px solid var(--cp-orange)'
                            : '1.5px solid var(--cp-line)',
                          background: elegido ? '#FFF1E8' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px' }}>{u.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                            {(u as any).dni ? `@${(u as any).dni} · ` : ''}{u.rol}
                          </div>
                        </div>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '13px',
                            color: elegido ? 'var(--cp-orange)' : 'var(--cp-navy)',
                          }}
                        >
                          {elegido ? '✓ Elegido' : 'Elegir →'}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {staffElegido && (
                <div
                  style={{
                    borderTop: '1px solid var(--cp-line)',
                    paddingTop: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>
                    ¿Dónde lo va a consumir {staffElegido.nombre}?
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setModalidad('local');
                        setCliNombre(`${staffElegido.nombre} (personal)`);
                        if (pisosActivos.length > 1) {
                          setPaso('floor');
                        } else {
                          setPaso('plan');
                        }
                      }}
                      style={{
                        flex: '1 1 200px',
                        minHeight: '48px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--cp-navy)',
                        background: 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      En el local (elegir mesa)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalidad('llevar');
                        setCliNombre(`${staffElegido.nombre} (personal)`);
                        setCliTelefono('999999999');
                        setPaso('items');
                      }}
                      style={{
                        flex: '1 1 200px',
                        minHeight: '48px',
                        borderRadius: '12px',
                        border: 0,
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Para llevar (sin mesa)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 2: ELEGIR PISO (si hay > 1)                              */}
          {/* ============================================================= */}
          {paso === 'floor' && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {pisosActivos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setPisoActivoId(f.id);
                    setPaso('plan');
                  }}
                  style={{
                    flex: '1 1 200px',
                    minHeight: '96px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '14px',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '22px',
                    }}
                  >
                    {f.nombre}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                    {(f.mesas || []).filter((m) => m.activo).length} mesas
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 3: PLANO Y MESAS                                         */}
          {/* ============================================================= */}
          {paso === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Modos: Tomar pedido, Juntar mesas, Liberar */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Modo
                </span>
                {[
                  { id: 'one', n: 'Tomar pedido' },
                  { id: 'join', n: 'Juntar varias mesas' },
                  { id: 'free', n: 'Liberar o marcar mesa' },
                ].map((m) => {
                  const on = modoPlano === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModoPlano(m.id as any);
                        if (m.id === 'one') {
                          setMesasSeleccionadas((prev) => prev.slice(0, 1));
                        }
                      }}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: on ? 'var(--cp-navy)' : 'transparent',
                        color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {m.n}
                    </button>
                  );
                })}
              </div>

              {/* Selector de piso si hay más de 1 */}
              {pisosActivos.length > 1 && (
                <div className="salon-pisos" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {pisosActivos.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPisoActivoId(f.id)}
                      style={{
                        minHeight: '44px',
                        padding: '0 16px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: pisoActivoId === f.id ? 'var(--cp-navy)' : 'transparent',
                        color: pisoActivoId === f.id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Leyenda */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                  color: 'var(--cp-soft)',
                }}
              >
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: 'var(--cp-greenbg)',
                      border: '1.5px solid var(--cp-ok)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Libre
                </span>
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: '#F6C9A5',
                      border: '1.5px solid var(--cp-orange)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Ocupada
                </span>
                <span>
                  <b
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '4px',
                      background: '#F9E0B5',
                      border: '1.5px solid var(--cp-gold)',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                    }}
                  />
                  Reservada (R)
                </span>
                {modoPlano === 'one' && <span>Toca una mesa libre para continuar.</span>}
              </div>

              {/* Mesas libres: atajo en chips, igual que el mockup */}
              {modoPlano !== 'free' && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>Mesas libres</span>
                  {mesasPiso
                    .filter((m) => m.estado !== 'OCUPADA')
                    .map((m) => {
                      const elegida = mesasSeleccionadas.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleClicMesa(m)}
                          style={{
                            minHeight: '44px',
                            padding: '0 14px',
                            borderRadius: '9999px',
                            border: `1.5px solid ${elegida ? 'var(--cp-navy)' : 'var(--cp-ok)'}`,
                            background: elegida ? 'var(--cp-navy)' : 'var(--cp-greenbg)',
                            color: elegida ? 'var(--cp-cream)' : 'var(--cp-navy)',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          {m.nombre || `Mesa ${m.numero}`}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* El plano del local, con sus paredes, cocina, barra y mesas */}
              <div style={{ maxWidth: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
                <CuadriculaPlano
                  columnas={planoActual?.cuadriculaAncho ?? planoActual?.cuadricula_ancho ?? pisoActual?.cuadricula_ancho ?? 20}
                  filas={planoActual?.cuadriculaAlto ?? planoActual?.cuadricula_alto ?? pisoActual?.cuadricula_alto ?? 12}
                  elementos={elementosPlano}
                  modoSalon
                  mesasSalon={mesasPiso}
                  mesasSeleccionadasIds={mesasSeleccionadas}
                  onSeleccionarMesaSalon={handleClicMesa}
                  alMantenerMesaSalon={setMesaParaForzar}
                  puedeForzarLiberacion={puedeForzarLiberacion}
                />
              </div>
              {avisoMesa && (
                <div
                  role="alert"
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--cp-rust)',
                    background: 'var(--cp-sand)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                  }}
                >
                  {avisoMesa}
                </div>
              )}

              {/* Barra inferior de confirmación de mesas (solo al juntar varias) */}
              {modoPlano === 'join' && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  borderTop: '1px solid var(--cp-line)',
                  paddingTop: '10px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  {mesasSeleccionadas.length > 0
                    ? `Mesas elegidas: ${textoMesas} · ${asientosSeleccionados} asientos`
                    : 'Toca las mesas que vas a juntar'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {mesasSeleccionadas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMesasSeleccionadas([])}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'transparent',
                        color: 'var(--cp-soft)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Limpiar
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={mesasSeleccionadas.length === 0}
                    onClick={() => setPaso('items')}
                    aria-label="Continuar a la carta"
                    style={{
                      minHeight: '48px',
                      padding: '0 20px',
                      borderRadius: '12px',
                      border: 0,
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '15px',
                      opacity: mesasSeleccionadas.length > 0 ? 1 : 0.5,
                      cursor: mesasSeleccionadas.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Continuar a la carta
                  </button>
                </div>
              </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 4: DATOS CLIENTE (Para llevar / Delivery)                */}
          {/* ============================================================= */}
          {paso === 'cli' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Quién es el cliente: con cuenta (celular) o invitado */}
              <div role="group" aria-label="Tipo de cliente" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(
                  [
                    ['cuenta', 'Cliente con cuenta (celular)'],
                    ['invitado', 'Invitado'],
                  ] as const
                ).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={modoCli === valor}
                    onClick={() => cambiarModoCli(valor)}
                    style={{
                      minHeight: '44px',
                      padding: '0 16px',
                      borderRadius: '9999px',
                      border: `1.5px solid ${modoCli === valor ? 'var(--cp-navy)' : 'var(--cp-line)'}`,
                      background: modoCli === valor ? 'var(--cp-navy)' : 'var(--cp-white)',
                      color: modoCli === valor ? 'var(--cp-white)' : 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    {texto}
                  </button>
                ))}
              </div>

              {modoCli === 'cuenta' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label
                      htmlFor="cli-cel"
                      style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}
                    >
                      Celular del cliente (9 dígitos) *
                    </label>
                    <input
                      id="cli-cel"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={telCli}
                      onChange={(e) => setTelCli(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="Ej.: 987654321"
                      style={{
                        width: '100%',
                        maxWidth: '260px',
                        boxSizing: 'border-box',
                        minHeight: '46px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        padding: '0 12px',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  {buscandoCuenta && (
                    <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Buscando cuenta…</div>
                  )}

                  {errorCuenta && (
                    <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
                      {errorCuenta}
                    </div>
                  )}

                  {sinCuenta && !buscandoCuenta && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--cp-navy)',
                      }}
                    >
                      <span>No hay cuenta con ese celular.</span>
                      <button
                        type="button"
                        onClick={() => cambiarModoCli('invitado')}
                        style={{
                          minHeight: '44px',
                          padding: '0 14px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Seguir como invitado
                      </button>
                    </div>
                  )}

                  {cuenta && (
                    <div
                      role="status"
                      style={{
                        background: 'var(--cp-white)',
                        border: '1.5px solid var(--cp-ok)',
                        borderRadius: '14px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '14px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      <b style={{ fontSize: '15px' }}>{cuenta.nombre}</b>
                      <span>Celular: {cuenta.telefono || 'sin celular'}</span>
                      <span>Puntos: {Number(cuenta.puntos).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {modoCli === 'invitado' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={cliNombre}
                    onChange={(e) => setCliNombre(e.target.value)}
                    placeholder="Ej.: María López"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '46px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 12px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Teléfono (WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={cliTelefono}
                    onChange={(e) => setCliTelefono(e.target.value)}
                    placeholder="9 dígitos"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '46px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 12px',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>
              )}

              {/* Libreta del cliente con cuenta: direcciones anteriores o una nueva */}
              {modalidad === 'delivery' && cuenta && cuenta.direcciones.length > 0 && (
                <div
                  role="group"
                  aria-label="Dirección de entrega"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  <b style={{ color: 'var(--cp-navy)', fontSize: '14px' }}>
                    ¿Lo enviamos a una dirección anterior o es una nueva?
                  </b>
                  {cuenta.direcciones.map((d) => {
                    const elegida = direccionElegida === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={elegida}
                        onClick={() => elegirDireccionAnterior(d)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '2px',
                          minHeight: '44px',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: `1.5px solid ${elegida ? 'var(--cp-ok)' : 'var(--cp-line)'}`,
                          background: 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        <span style={{ fontWeight: 800 }}>{d.direccion}</span>
                        {d.referencia && (
                          <span style={{ fontSize: '12px' }}>Referencia: {d.referencia}</span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          Usada {d.usos} {d.usos === 1 ? 'vez' : 'veces'} · última vez{' '}
                          {fechaCortaDireccion(d.ultimoUsoEn)}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={direccionElegida === 'nueva'}
                    onClick={elegirDireccionNueva}
                    style={{
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: `1.5px dashed ${direccionElegida === 'nueva' ? 'var(--cp-ok)' : 'var(--cp-navy)'}`,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Dirección nueva
                  </button>
                </div>
              )}

              {modalidad === 'delivery' && mostrarFormDireccion && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        Dirección *
                      </label>
                      <input
                        type="text"
                        value={cliDireccion}
                        onChange={(e) => setCliDireccion(e.target.value)}
                        placeholder="Jr. / Av. / Calle y número"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '46px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          padding: '0 12px',
                          fontSize: '14px',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        Referencia
                      </label>
                      <input
                        type="text"
                        value={cliReferencia}
                        onChange={(e) => setCliReferencia(e.target.value)}
                        placeholder="Frente a…, portón…"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '46px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          padding: '0 12px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Ubicación en el mapa */}
                  <div
                    style={{
                      background: 'var(--cp-white)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '14px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <b style={{ color: 'var(--cp-navy)', fontSize: '14px' }}>
                        Ubicación en el mapa (calcula zona y envío)
                      </b>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setCliPuntoMapa({
                                  lat: pos.coords.latitude,
                                  lng: pos.coords.longitude,
                                });
                              },
                              () => {
                                setCliPuntoMapa({ lat: -12.0185, lng: -76.9630 });
                              },
                              { timeout: 6000 },
                            );
                          } else {
                            setCliPuntoMapa({ lat: -12.0185, lng: -76.9630 });
                          }
                        }}
                        style={{
                          minHeight: '36px',
                          padding: '0 12px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-navy)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Usar GPS de este equipo
                      </button>
                    </div>

                    <BuscadorDireccion
                      onElegir={(p, texto) => {
                        setCliPuntoMapa(p);
                        if (!cliDireccion.trim() && texto) {
                          setCliDireccion(texto.split(',').slice(0, 2).join(',').trim());
                        }
                      }}
                    />

                    <MapaUbicacion
                      punto={cliPuntoMapa}
                      onCambiar={(coord) => setCliPuntoMapa(coord)}
                      altura={220}
                      local={sedeLocal}
                      ajustarA={cliPuntoMapa ? 'ambos' : 'local'}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                      El icono de la tienda es la sede (Caprichos).
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: !cliPuntoMapa
                          ? 'var(--cp-soft)'
                          : zonaInfo?.cubierto
                          ? 'var(--cp-ok)'
                          : 'var(--cp-rust)',
                      }}
                    >
                      {!cliPuntoMapa
                        ? 'Haz clic en el mapa para fijar el punto exacto de entrega.'
                        : zonaInfo?.cubierto
                        ? `Pin en el mapa (${cliPuntoMapa.lat.toFixed(4)}, ${cliPuntoMapa.lng.toFixed(4)}) · Zona ${zonaInfo.zona} · Envío S/ ${Number(zonaInfo.tarifa || 0).toFixed(2)} (gratis ${zonaInfo.modoGratis === 'desde' ? 'desde' : 'sobre'} S/ ${Number(zonaInfo.gratisDesde || 70).toFixed(2)})`
                        : 'Fuera de cobertura de reparto.'}
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={!cliListo}
                onClick={() => setPaso('items')}
                style={{
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '15px',
                  marginTop: '8px',
                  opacity: cliListo ? 1 : 0.5,
                  cursor: cliListo ? 'pointer' : 'not-allowed',
                }}
              >
                Continuar a productos →
              </button>
            </div>
          )}

          {/* ============================================================= */}
          {/* PASO 5: ITEMS Y CARTA PÚBLICA                                 */}
          {/* ============================================================= */}
          {paso === 'items' && (
            <div className="np-items">
              {/* IZQUIERDA: Catálogo de productos */}
              <div className="np-catalogo">
                {/* Categorías en tira horizontal */}
                <div className="np-categorias">
                  <button
                    type="button"
                    onClick={() => setCategoriaActivaId('todas')}
                    style={{
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background:
                        categoriaActivaId === 'todas' ? 'var(--cp-navy)' : 'transparent',
                      color:
                        categoriaActivaId === 'todas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    Todos
                  </button>
                  {categorias.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoriaActivaId(c.id)}
                      style={{
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background:
                          categoriaActivaId === c.id ? 'var(--cp-navy)' : 'transparent',
                        color:
                          categoriaActivaId === c.id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>

                {/* Buscador y toggle con/sin imagen */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto"
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 16px',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setConImagenes(!conImagenes)}
                    style={{
                      flex: 'none',
                      minHeight: '40px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background: conImagenes ? 'var(--cp-navy)' : 'transparent',
                      color: conImagenes ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {conImagenes ? 'Con imagen' : 'Sin imagen'}
                  </button>
                </div>

                {/* Grilla de productos */}
                {cargandoCarta ? (
                  <Cargando mensaje="Cargando productos..." pantallaCompleta={false} />
                ) : errorCarta ? (
                  <div style={{ padding: '16px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                    {errorCarta}
                  </div>
                ) : (
                  <div className="np-grilla">
                    {productosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProductoSeleccionado(p)}
                        className="np-producto"
                      >
                        {conImagenes && (
                          <span className="np-producto-foto">
                            {p.fotoUrl ? (
                              <img
                                src={p.fotoUrl}
                                alt={p.nombre}
                                loading="lazy"
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  height: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontFamily: 'Montserrat, sans-serif',
                                  fontWeight: 800,
                                  fontSize: '22px',
                                  color: 'var(--cp-navy)',
                                }}
                              >
                                {p.nombre
                                  .split(' ')
                                  .filter((w) => w.length > 2)
                                  .slice(0, 2)
                                  .map((w) => w[0]?.toUpperCase())
                                  .join('')}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="np-producto-texto">
                          <span className="np-producto-nombre">
                            {p.nombre}
                          </span>
                          <span className="np-producto-precio">
                            {(p.tamanos || []).length > 0 ? 'Desde ' : ''}S/{' '}
                            {Number(p.precio || 0).toFixed(2)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DERECHA: Carrito del pedido */}
              <div
                className={carritoAbierto ? 'np-carrito np-carrito--abierto' : 'np-carrito'}
              >
                {/* Celular: barra inferior con el resumen; al tocarla se expande el pedido */}
                <button
                  type="button"
                  className="np-barra-carrito"
                  aria-expanded={carritoAbierto}
                  onClick={() => setCarritoAbierto(!carritoAbierto)}
                >
                  <span>
                    {lineas.reduce((suma, l) => suma + l.cantidad, 0)} productos · S/{' '}
                    {total.toFixed(2)}
                  </span>
                  <span>{carritoAbierto ? 'Cerrar' : 'Ver pedido'}</span>
                </button>

                {/* Mesa y «Pide» en una fila de chips */}
                <div className="np-chips">
                {/* Cabecera del carrito: Mesa / Cambiar */}
                <div className="np-chip-mesa">
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                    {modalidad === 'local'
                      ? `Mesa: ${textoMesas}`
                      : `${modalidad === 'delivery' ? 'Delivery' : 'Para llevar'} · ${cliNombre || 'Cliente'}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaso(modalidad === 'local' ? 'plan' : 'cli')}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--cp-orange)',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {modalidad === 'local' ? 'Cambiar mesa' : 'Cambiar datos'}
                  </button>
                </div>

                {/* Mesa: nombre obligatorio para la boleta, la etiqueta y la lista; teléfono opcional */}
                {modalidad === 'local' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="np-nombre-mesa" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--cp-navy)' }}>
                      Nombre del cliente *
                    </label>
                    {nombreMesaFijo !== null ? (
                      <div
                        id="np-nombre-mesa"
                        style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}
                      >
                        {nombreMesa || 'Elige la cuenta del cliente'}
                      </div>
                    ) : (
                      <input
                        id="np-nombre-mesa"
                        type="text"
                        value={cliNombre}
                        onChange={(e) => setCliNombre(e.target.value)}
                        placeholder="Ej.: María López"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: '40px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          padding: '0 12px',
                          fontSize: '14px',
                        }}
                      />
                    )}
                    {pideMode !== 'cliente' && (
                      <>
                        <label htmlFor="np-telefono-mesa" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--cp-navy)' }}>
                          Teléfono (opcional)
                        </label>
                        <input
                          id="np-telefono-mesa"
                          type="tel"
                          inputMode="numeric"
                          value={cliTelefono}
                          onChange={(e) => setCliTelefono(e.target.value)}
                          placeholder="9 dígitos"
                          aria-invalid={!telefonoMesaValido}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '40px',
                            borderRadius: '10px',
                            border: `1.5px solid ${telefonoMesaValido ? 'var(--cp-line)' : 'var(--cp-rust)'}`,
                            background: 'var(--cp-white)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                        {telefonoMesaValido ? (
                          <span style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                            Si lo escribes le enviamos una encuesta por WhatsApp al terminar
                          </span>
                        ) : (
                          <span role="alert" style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                            El teléfono debe tener 9 dígitos y empezar con 9
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ¿Quién pide? (Sin cuenta / Cliente con cuenta / Personal) */}
                {!pideOpen ? (
                  <div className="np-chip-pide">
                    <span>
                      <b>Pide:</b>{' '}
                      {pideMode === 'personal' && staffElegido
                        ? `${staffElegido.nombre} (personal · descuento al cobrar a crédito)`
                        : pideMode === 'cliente' && clienteEncontrado
                        ? `Cliente: ${clienteEncontrado.nombre} (${clienteEncontrado.puntos} pts)`
                        : 'Sin cuenta'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPideOpen(true)}
                      style={{
                        minHeight: '30px',
                        padding: '0 10px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: 'transparent',
                        color: 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div
                    className="np-pide-abierto"
                    style={{
                      background: 'var(--cp-cream)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
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
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--cp-soft)',
                        }}
                      >
                        ¿QUIÉN PIDE?
                      </span>
                      <button
                        type="button"
                        onClick={() => setPideOpen(false)}
                        style={{
                          minHeight: '28px',
                          padding: '0 8px',
                          borderRadius: '9999px',
                          border: '1px solid var(--cp-line)',
                          background: 'transparent',
                          color: 'var(--cp-navy)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Listo
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {[
                        { id: 'anon', n: 'Sin cuenta' },
                        { id: 'cliente', n: 'Cliente con cuenta (celular)' },
                        { id: 'personal', n: 'Personal' },
                      ].map((m) => {
                        const on = pideMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setPideMode(m.id as any);
                              if (m.id === 'anon') {
                                setStaffElegido(null);
                                setClienteEncontrado(null);
                                setPideOpen(false);
                              }
                            }}
                            style={{
                              minHeight: '34px',
                              padding: '0 10px',
                              borderRadius: '9999px',
                              border: '1.5px solid var(--cp-navy)',
                              background: on ? 'var(--cp-navy)' : 'transparent',
                              color: on ? 'var(--cp-cream)' : 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            {m.n}
                          </button>
                        );
                      })}
                    </div>

                    {pideMode === 'anon' && (
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                        Pedido sin cuenta: no suma puntos ni aplica descuento de personal.
                      </div>
                    )}

                    {pideMode === 'cliente' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="search"
                            autoFocus
                            inputMode={/^\d*$/.test(pideQ.trim()) ? 'numeric' : 'search'}
                            value={pideQ}
                            onChange={(e) => setPideQ(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                forzarBusquedaCliente();
                              }
                            }}
                            placeholder="Nombre o celular del cliente"
                            aria-label="Buscar cliente por nombre o celular"
                            style={{
                              flex: 1,
                              boxSizing: 'border-box',
                              minHeight: '44px',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-line)',
                              background: 'var(--cp-white)',
                              padding: '0 8px',
                              fontSize: '12px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={forzarBusquedaCliente}
                            style={{
                              minHeight: '44px',
                              padding: '0 10px',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-navy)',
                              background: 'transparent',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Buscar
                          </button>
                        </div>
                        {buscandoCliente && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>Buscando…</div>
                        )}
                        {errorBuscarCliente && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                            No se pudo buscar. Intenta de nuevo.
                          </div>
                        )}
                        {!buscandoCliente && !errorBuscarCliente && consultaResuelta === pideQ.trim() && resultadosCliente.length === 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                            No hay cuenta con ese nombre o celular.
                          </div>
                        )}
                        {!buscandoCliente && resultadosCliente.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              maxHeight: '180px',
                              overflowY: 'auto',
                            }}
                          >
                            {resultadosCliente.map((c, idx) => (
                              <button
                                key={`${c.partyId}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setClienteEncontrado({ nombre: c.nombre, telefono: c.telefono, puntos: c.puntos, partyId: c.partyId });
                                  setPideQ('');
                                  setPideOpen(false);
                                }}
                                style={{
                                  minHeight: '44px',
                                  padding: '6px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--cp-line)',
                                  background: 'var(--cp-white)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <b>{c.nombre}</b>
                                <span style={{ color: 'var(--cp-soft)', whiteSpace: 'nowrap' }}>
                                  {c.telefono ? `${c.telefono} · ` : ''}{c.puntos} pts
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {pideMode === 'personal' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="search"
                          autoFocus
                          value={busquedaPersonal}
                          onChange={(e) => setBusquedaPersonal(e.target.value)}
                          placeholder="Buscar por usuario o nombre"
                          aria-label="Buscar personal"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '44px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--cp-line)',
                            background: 'var(--cp-white)',
                            padding: '0 8px',
                            fontSize: '12px',
                          }}
                        />
                        <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                          {personalFiltrado.length} {personalFiltrado.length === 1 ? 'resultado' : 'resultados'}
                        </div>
                        {personalFiltrado.length === 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                            Sin resultados
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            maxHeight: '140px',
                            overflowY: 'auto',
                          }}
                        >
                          {personalFiltrado
                            .map((u) => {
                              const qPersonal = busquedaPersonal.toLowerCase().trim();
                              const on = String(staffElegido?.partyId) === String(u.partyId);
                              return (
                                <button
                                  key={u.partyId}
                                  type="button"
                                  onClick={() => {
                                    setStaffElegido(u);
                                    setPideOpen(false);
                                  }}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '8px',
                                    border: on
                                      ? '1.5px solid var(--cp-orange)'
                                      : '1px solid var(--cp-line)',
                                    background: on ? '#FFF1E8' : 'var(--cp-white)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <b>{resaltarCoincidencia(u.nombre, qPersonal)}</b>
                                  <span style={{ color: 'var(--cp-soft)' }}>
                                    {(u as any).dni ? `@${(u as any).dni} · ` : ''}{resaltarCoincidencia(u.rol || '', qPersonal)}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                          El descuento de personal se aplica cuando el pedido se cobra con «Cobrar a crédito del personal».
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* Lista de líneas */}
                <div className="np-lineas">
                  {lineas.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      Aún no agregas productos. Toca un producto de la izquierda para configurarlo.
                    </div>
                  ) : (
                    lineas.map((lin) => (
                      <div key={lin.id} className="np-linea">
                        <div className="np-linea-fila">
                          <span className="np-qty">
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, -1)}
                            >
                              −
                            </button>
                            <span>{lin.cantidad}</span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, 1)}
                            >
                              +
                            </button>
                          </span>
                          <span className="np-linea-nombre" title={lin.nombre}>
                            {lin.cantidad} x {lin.nombre}
                            {lin.tamanoNombre && <small> · {lin.tamanoNombre}</small>}
                          </span>
                          <span className="np-linea-precio">S/ {lin.precioTotal.toFixed(2)}</span>
                          <button
                            type="button"
                            className="np-quitar"
                            onClick={() => quitarLinea(lin.id)}
                          >
                            Quitar
                          </button>
                        </div>
                        {(lin.personas || []).length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                            Para: {lin.personas?.join(', ')}
                          </div>
                        )}
                        {lin.nota && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)' }}>
                            Nota: {lin.nota}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Cupón: plegado detrás de un botón; se despliega al tocarlo */}
                <button
                  type="button"
                  className="np-cupon-toggle"
                  aria-expanded={cuponAbierto || !!cuponAplicado}
                  onClick={() => setCuponAbierto(!cuponAbierto)}
                >
                  Cupón
                </button>
                {(cuponAbierto || cuponAplicado) && (
                <div className="np-cupon-fila">
                  <input
                    type="text"
                    value={cuponInput}
                    onChange={(e) => setCuponInput(e.target.value)}
                    placeholder="Código de cupón (opcional)"
                    style={{
                      flex: 1,
                      minHeight: '38px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (cuponAplicado) {
                        setCuponAplicado(null);
                        setCuponInput('');
                        setCuponError(null);
                      } else {
                        handleAplicarCupon();
                      }
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {cuponAplicado ? 'Quitar' : 'Aplicar'}
                  </button>
                </div>
                )}
                {cuponError && (
                  <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                    {cuponError}
                  </div>
                )}
                {cuponAplicado && (
                  <div style={{ fontSize: '12px', color: 'var(--cp-green)', fontWeight: 700 }}>
                    Cupón {cuponAplicado.codigo} aplicado: - S/{' '}
                    {cuponAplicado.descuento.toFixed(2)}
                  </div>
                )}

                {/* Totales */}
                <div className="np-totales">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>S/ {subtotal.toFixed(2)}</span>
                  </div>
                  {descuento > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                      }}
                    >
                      <span>Cupón ({cuponAplicado?.codigo})</span>
                      <span>- S/ {descuento.toFixed(2)}</span>
                    </div>
                  )}
                  {modalidad === 'delivery' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Envío ({zonaInfo?.zona || 'Por calcular'})</span>
                      <span>
                        {!cliPuntoMapa
                          ? 'Por calcular'
                          : envioCalculado === 0
                          ? 'GRATIS'
                          : `S/ ${envioCalculado.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  <div
                    className="np-total-final"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '16px',
                    }}
                  >
                    <span>Total</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                <PlanPagoEditor
                  total={total}
                  filas={filasPlan}
                  onChange={setFilasPlan}
                  pagaCon={cliPagaCon}
                  onPagaCon={setCliPagaCon}
                  pagaConObligatorio={modalidad === 'delivery'}
                />

                {/* Botón Enviar a cocina / Registrar pedido */}
                <button
                  type="button"
                  disabled={
                    lineas.length === 0 ||
                    (modalidad === 'local' && mesasSeleccionadas.length === 0) ||
                    (modalidad === 'local' && (!nombreMesaListo || !telefonoMesaValido)) ||
                    errorPlanAhora !== null ||
                    (modalidad === 'delivery' && montoEfectivoAhora > 0 && pagaConValido() === undefined)
                  }
                  onClick={() => setConfirmarEnviar(true)}
                  className="salon-pie-fijo np-enviar"
                  aria-label={
                    modalidad === 'local' ? 'Enviar directo a cocina' : 'Registrar pedido'
                  }
                  style={{
                    minHeight: '52px',
                    border: 0,
                    borderRadius: '12px',
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '15px',
                    opacity:
                      lineas.length > 0 &&
                      (modalidad !== 'local' || mesasSeleccionadas.length > 0)
                        ? 1
                        : 0.5,
                    cursor:
                      lineas.length > 0 &&
                      (modalidad !== 'local' || mesasSeleccionadas.length > 0)
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  {modalidad === 'local' ? 'Enviar directo a cocina' : 'Registrar pedido'} · S/{' '}
                  {total.toFixed(2)}
                </button>
                {motivoNoEnviar && (
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', textAlign: 'center' }}>
                    {motivoNoEnviar}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ventana de Opciones de Producto */}
      {productoSeleccionado && (
        <VentanaOpcionesProducto
          producto={productoSeleccionado}
          alCerrar={() => setProductoSeleccionado(null)}
          alAgregar={handleAgregarProductoConfigurado}
          oferta={comboDeProducto(ofertasCombo, productoSeleccionado.id)}
        />
      )}

      {/* Diálogo Confirmar Enviar Pedido */}
      <Confirmar
        abierto={confirmarEnviar}
        titulo={
          modalidad === 'local'
            ? '¿Enviar pedido directo a cocina?'
            : '¿Registrar este pedido?'
        }
        mensaje={
          modalidad === 'local'
            ? `Se enviarán los productos para la mesa ${textoMesas}. Comenzará su preparación en cocina y se descontará el stock.${clientePideId && clienteEncontrado ? ` Pide ${clienteEncontrado.nombre}: el pedido suma sus puntos al cobrar.` : ''}`
            : `Se registrará el pedido (${modalidad === 'delivery' ? 'Delivery' : 'Para llevar'}) a nombre de ${cliNombre || (clientePideId && clienteEncontrado ? clienteEncontrado.nombre : 'Cliente')} por S/ ${total.toFixed(2)}.`
        }
        textoConfirmar={modalidad === 'local' ? 'Sí, enviar comanda' : 'Sí, registrar'}
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={handleEnviarPedido}
        alCancelar={() => setConfirmarEnviar(false)}
      />

      {/* Voucher del pedido digital recién creado */}
      {pedidoVoucher && (
        <ModalVoucherPedido
          pedido={pedidoVoucher.pedido}
          alCerrar={terminarPedidoDigital}
          alSubirDespues={terminarPedidoDigital}
        />
      )}

      {/* Modal Liberar Mesa si se activa en modo free */}
      {mesaParaLiberar && (
        <ModalLiberarMesa
          abierto={true}
          mesa={mesaParaLiberar}
          alCerrar={() => setMesaParaLiberar(null)}
          alLiberar={async (_mesaId: string, motivo: string) => {
            await salonApi.liberarMesaManual(mesaParaLiberar.id, motivo);
            setMesaParaLiberar(null);
            await refrescarMesas();
            await alRefrescarMesas?.();
          }}
        />
      )}

      {/* Forzar liberación: mesa ocupada mantenida presionada 3 s (solo con permiso mesas/liberar) */}
      {mesaParaForzar && (
        <ModalForzarLiberarMesa
          mesa={mesaParaForzar}
          alCerrar={() => setMesaParaForzar(null)}
          alForzar={async (mesaId: string, motivo: string) => {
            await salonApi.liberarMesaManual(mesaId, motivo, true);
            setMesaParaForzar(null);
            await refrescarMesas();
            await alRefrescarMesas?.();
          }}
        />
      )}
    </>
  );
}
