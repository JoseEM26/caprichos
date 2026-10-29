import { useEffect, useState, useMemo } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { Cargando } from '../../../comun/Cargando';
import { api } from '../../../comun/api';
import { MapaUbicacion } from '../../../comun/mapa/MapaUbicacion';
import type { Punto as CoordenadaMapa } from '../../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../../comun/mapa/BuscadorDireccion';
import { CategoriaCarta, ProductoCarta, OpcionCarta as OpcionProducto } from '../../../carta/tipos';
import { ElementoPlano, MesaSalon, PisoPlano, PisoSalon } from '../tipos';
import { CuadriculaPlano } from './CuadriculaPlano';
import { VentanaOpcionesProducto, ProductoConfigurado } from './VentanaOpcionesProducto';
import { ModalLiberarMesa } from './ModalLiberarMesa';
import { calcularEnvioFinal, reglaEnvioGratis } from '@caprichos/compartido';
import { salonApi } from '../api';
import '../salon.css';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { listarPersonalActivo, ColaboradorActivo as PersonalItem } from '../../creditos/creditosApi';

export interface ModalNuevoPedidoMesaProps {
  abierto: boolean;
  alCerrar: () => void;
  pisos: PisoSalon[];
  mesaPreseleccionadaId?: string;
  mesasPreseleccionadasIds?: string[];
  /** Desde Pedidos y caja se abre en «¿Qué vas a hacer?» (local, para llevar o delivery) */
  pasoInicial?: 'modal';
  reservaIdPreseleccionada?: string;
  /** Si viene desde «Repetir este pedido», precarga modalidad, cliente y líneas en el paso items */
  pedidoRepetir?: any | null;
  alExitoPedido?: (pedido: any) => void;
  alRefrescarMesas?: () => Promise<void>;
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
}

export function ModalNuevoPedidoMesa({
  abierto,
  alCerrar,
  pisos = [],
  mesaPreseleccionadaId,
  mesasPreseleccionadasIds = [],
  pasoInicial,
  reservaIdPreseleccionada,
  pedidoRepetir = null,
  alExitoPedido,
  alRefrescarMesas,
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

  // Mesas seleccionadas
  const [mesasSeleccionadas, setMesasSeleccionadas] = useState<string[]>(todasLasMesasIniciales);

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

  // ¿Quién pide? ('anon' | 'cliente' | 'personal')
  const [pideMode, setPideMode] = useState<'anon' | 'cliente' | 'personal'>(
    pedidoRepetir?.es_personal ? 'personal' : 'anon',
  );
  const [pideOpen, setPideOpen] = useState(false);
  const [pideDni, setPideDni] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState<{
    nombre: string;
    dni: string;
    puntos: number;
  } | null>(null);
  const [clienteNoHallado, setClienteNoHallado] = useState(false);

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

  // Carta y productos
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [cargandoCarta, setCargandoCarta] = useState(false);
  const [errorCarta, setErrorCarta] = useState<string | null>(null);
  const [categoriaActivaId, setCategoriaActivaId] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [conImagenes, setConImagenes] = useState(true);

  // Ventana de opciones del producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoCarta | null>(null);

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

  // Modal Liberar mesa
  const [mesaParaLiberar, setMesaParaLiberar] = useState<MesaSalon | null>(null);

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
          personas: personas && personas.length > 0 ? personas : lin.personas,
        };
      });

      // desde Pedidos y caja el canal es CAJA; el mozo desde el salón sigue siendo MOZO
      const canalEnvio: 'MOZO' | 'CAJA' = pasoInicial === 'modal' ? 'CAJA' : 'MOZO';
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
            cliente: cliNombre.trim()
              ? {
                  nombre: cliNombre.trim(),
                  telefono:
                    cliTelefono.replace(/\D/g, '').length === 9
                      ? cliTelefono.replace(/\D/g, '')
                      : '999999999',
                }
              : undefined,
          },
          idempotencyKey,
        );
      } else {
        const telDigitos = cliTelefono.replace(/\D/g, '');
        const telefonoFinal = /^9\d{8}$/.test(telDigitos) ? telDigitos : '999999999';
        const pagaConNum = Number(cliPagaCon);
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
              metodo: 'EFECTIVO',
              pagaCon:
                !isNaN(pagaConNum) && pagaConNum >= total ? pagaConNum : undefined,
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
          },
          idempotencyKey,
        );
      }

      setConfirmarEnviar(false);
      alExitoPedido?.(res);
      await alRefrescarMesas?.();
      alCerrar();
    } catch (err: any) {
      setConfirmarEnviar(false);
      if (err?.codigo === 'MESA_OCUPADA') {
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

              {modalidad === 'delivery' && (
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

                    <div>
                      <label style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                        ¿Paga en efectivo? ¿con cuánto?
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        value={cliPagaCon}
                        onChange={(e) => setCliPagaCon(e.target.value)}
                        placeholder="Opcional: ej. 50"
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
                    />

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
                disabled={
                  !cliNombre.trim() ||
                  (modalidad === 'delivery' && !cliDireccion.trim() && !cliPuntoMapa)
                }
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
                  opacity:
                    cliNombre.trim() &&
                    (modalidad !== 'delivery' || cliDireccion.trim() || cliPuntoMapa)
                      ? 1
                      : 0.5,
                  cursor:
                    cliNombre.trim() &&
                    (modalidad !== 'delivery' || cliDireccion.trim() || cliPuntoMapa)
                      ? 'pointer'
                      : 'not-allowed',
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
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'flex-start',
              }}
            >
              {/* IZQUIERDA: Catálogo de productos */}
              <div
                style={{
                  flex: '3 1 520px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Categorías en tira horizontal */}
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCategoriaActivaId('todas')}
                    style={{
                      flex: 'none',
                      minHeight: '40px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background:
                        categoriaActivaId === 'todas' ? 'var(--cp-navy)' : 'transparent',
                      color:
                        categoriaActivaId === 'todas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
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
                        flex: 'none',
                        minHeight: '40px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background:
                          categoriaActivaId === c.id ? 'var(--cp-navy)' : 'transparent',
                        color:
                          categoriaActivaId === c.id ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
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
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: conImagenes
                        ? 'repeat(auto-fill, minmax(160px, 1fr))'
                        : 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '14px',
                      maxHeight: '52vh',
                      overflowY: 'auto',
                      padding: '4px',
                    }}
                  >
                    {productosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProductoSeleccionado(p)}
                        style={{
                          background: 'var(--cp-white)',
                          border: '1px solid var(--cp-line)',
                          borderRadius: '12px',
                          padding: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {conImagenes && (
                          <span
                            style={{
                              display: 'block',
                              width: '100%',
                              aspectRatio: '4 / 3',
                              background: 'var(--cp-gold)',
                              flex: 'none',
                            }}
                          >
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
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px 12px' }}>
                          <span
                            style={{
                              fontFamily: 'Montserrat, sans-serif',
                              fontWeight: 800,
                              fontSize: '14px',
                              lineHeight: '18px',
                            }}
                          >
                            {p.nombre}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-soft)' }}>
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
                style={{
                  flex: '2 1 340px',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: 'var(--cp-white)',
                  border: '1.5px solid var(--cp-line)',
                  borderRadius: '14px',
                  padding: '14px',
                }}
              >
                {/* Cabecera del carrito: Mesa / Cambiar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--cp-line)',
                    paddingBottom: '8px',
                  }}
                >
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

                {/* ¿Quién pide? (Sin cuenta / Cliente con cuenta / Personal) */}
                {!pideOpen ? (
                  <div
                    style={{
                      background: 'var(--cp-cream)',
                      border: '1px solid var(--cp-line)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                    }}
                  >
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
                        { id: 'cliente', n: 'Cliente con cuenta (DNI)' },
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
                            type="text"
                            inputMode="numeric"
                            value={pideDni}
                            onChange={(e) => setPideDni(e.target.value)}
                            placeholder="DNI de 8 dígitos"
                            style={{
                              flex: 1,
                              minHeight: '36px',
                              borderRadius: '8px',
                              border: '1.5px solid var(--cp-line)',
                              background: 'var(--cp-white)',
                              padding: '0 8px',
                              fontSize: '12px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const d = pideDni.replace(/\D/g, '');
                              try {
                                const res: any = await api.get(`/admin/clientes?buscar=${d}`);
                                const list = Array.isArray(res) ? res : res?.items || [];
                                const c = list.find((x: any) => String(x.dni) === d) || list[0];
                                if (c) {
                                  setClienteEncontrado({
                                    nombre: c.nombre || `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
                                    dni: c.dni || d,
                                    puntos: Number(c.puntos || 0),
                                  });
                                  setClienteNoHallado(false);
                                  setPideOpen(false);
                                } else {
                                  setClienteEncontrado(null);
                                  setClienteNoHallado(true);
                                }
                              } catch {
                                setClienteEncontrado(null);
                                setClienteNoHallado(true);
                              }
                            }}
                            style={{
                              minHeight: '36px',
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
                        {clienteNoHallado && (
                          <div style={{ fontSize: '11px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                            No hay cuenta con ese DNI.
                          </div>
                        )}
                      </div>
                    )}

                    {pideMode === 'personal' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="search"
                          value={busquedaPersonal}
                          onChange={(e) => setBusquedaPersonal(e.target.value)}
                          placeholder="Buscar por usuario o nombre"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: '36px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--cp-line)',
                            background: 'var(--cp-white)',
                            padding: '0 8px',
                            fontSize: '12px',
                          }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            maxHeight: '140px',
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
                                  <b>{u.nombre}</b>
                                  <span style={{ color: 'var(--cp-soft)' }}>
                                    {(u as any).dni ? `@${(u as any).dni} · ` : ''}{u.rol}
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

                {/* Lista de líneas */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
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
                      <div
                        key={lin.id}
                        style={{
                          border: '1px solid var(--cp-line)',
                          borderRadius: '10px',
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          background: 'var(--cp-cream)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: '14px',
                          }}
                        >
                          <span>
                            {lin.cantidad} x {lin.nombre}
                          </span>
                          <span>S/ {lin.precioTotal.toFixed(2)}</span>
                        </div>
                        {lin.tamanoNombre && (
                          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                            {lin.tamanoNombre}
                          </div>
                        )}
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
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, -1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '14px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              −
                            </button>
                            <span style={{ fontWeight: 800, fontSize: '13px' }}>
                              {lin.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadLinea(lin.id, 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '14px',
                                border: '1.5px solid var(--cp-navy)',
                                background: 'transparent',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarLinea(lin.id)}
                            style={{
                              border: 0,
                              background: 'transparent',
                              color: 'var(--cp-rust)',
                              fontSize: '12px',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cupón */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    borderTop: '1px solid var(--cp-line)',
                    paddingTop: '8px',
                    fontSize: '13px',
                  }}
                >
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
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '16px',
                      borderTop: '1px dashed var(--cp-line)',
                      paddingTop: '6px',
                    }}
                  >
                    <span>Total</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botón Enviar a cocina / Registrar pedido */}
                <button
                  type="button"
                  disabled={
                    lineas.length === 0 ||
                    (modalidad === 'local' && mesasSeleccionadas.length === 0)
                  }
                  onClick={() => setConfirmarEnviar(true)}
                  className="salon-pie-fijo"
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
            ? `Se enviarán los productos para la mesa ${textoMesas}. Comenzará su preparación en cocina y se descontará el stock.`
            : `Se registrará el pedido (${modalidad === 'delivery' ? 'Delivery' : 'Para llevar'}) a nombre de ${cliNombre || 'Cliente'} por S/ ${total.toFixed(2)}.`
        }
        textoConfirmar={modalidad === 'local' ? 'Sí, enviar comanda' : 'Sí, registrar'}
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={handleEnviarPedido}
        alCancelar={() => setConfirmarEnviar(false)}
      />

      {/* Modal Liberar Mesa si se activa en modo free */}
      {mesaParaLiberar && (
        <ModalLiberarMesa
          abierto={true}
          mesa={mesaParaLiberar}
          alCerrar={() => setMesaParaLiberar(null)}
          alLiberar={async (_mesaId: string, motivo: string) => {
            await salonApi.liberarMesaManual(mesaParaLiberar.id, motivo);
            setMesaParaLiberar(null);
            await alRefrescarMesas?.();
          }}
        />
      )}
    </>
  );
}
