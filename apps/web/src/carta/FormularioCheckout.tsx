import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import {
  aplicaEnvioGratis,
  calcularEnvioFinal,
  calcularTotalPedido,
  reglaEnvioGratis,
  type ReglaEnvioGratis,
} from '@caprichos/compartido';
import { api, ErrorApi } from '../comun/api';
import { MapaUbicacion } from '../comun/mapa/MapaUbicacion';
import { SEDE_DEFECTO } from '../comun/mapa/sedeDefecto';
import { BuscadorDireccion } from '../comun/mapa/BuscadorDireccion';
import { enlaceGoogleMaps } from '../comun/mapa/leaflet';
import { useCarrito } from './CarritoContext';
import { PuntosCanje, estimarPuntos } from './cuenta/PuntosCanje';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import { guardarPedido } from './seguimiento';
import { SelectorDireccionesCliente } from './SelectorDireccionesCliente';
import {
  ConsultaEnvioRespuesta,
  DatosLocalCarta,
  DireccionCliente,
  EstadoLocalCarta,
  MetodoPago,
  ModalidadEntrega,
  TipoComprobante,
} from './tipos';
import type { OfertaItem } from '../admin/ofertas/ofertasApi';

interface FormularioCheckoutProps {
  estadoLocal: EstadoLocalCarta | null;
  datosLocal: DatosLocalCarta | null;
}

/** Línea de envío con zona y tarifa; si el monto la deja en gratis, lo dice y cuánto sería sin la promo. */
function textoResumenEnvio(zona: string, tarifa: number, subtotal: number, regla: ReglaEnvioGratis): string {
  const base = `Zona ${zona} · envío S/ ${tarifa.toFixed(2)}`;
  if (!aplicaEnvioGratis(subtotal, regla)) return base;
  return `${base} (gratis por tu compra ${regla.modo === 'desde' ? 'desde' : 'sobre'} S/ ${regla.monto})`;
}

export function FormularioCheckout({
  estadoLocal,
  datosLocal,
}: FormularioCheckoutProps) {
  const {
    lineas,
    subtotal,
    checkoutAbierto,
    cerrarCheckout,
    abrirCajon,
    limpiarCarrito,
    setPedidoConfirmado,
  } = useCarrito();

  // Control de apartados (pasos 1, 2, 3)
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [pasoMaximo, setPasoMaximo] = useState<1 | 2 | 3>(1);
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);

  // Modal de mapa a pantalla completa
  const [mapaCompletoAbierto, setMapaCompletoAbierto] = useState(false);

  // Modalidad (DELIVERY o RECOGER)
  const [modalidad, setModalidad] = useState<ModalidadEntrega>('DELIVERY');

  // Cliente
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  // Cumpleaños: solo lo pide quien tiene cuenta y aún no lo tiene (el pedido sin cuenta no lo pide)
  const [cumpleCliente, setCumpleCliente] = useState('');

  // Entrega
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [zonaEnvio, setZonaEnvio] = useState<string | null>(null);
  const [tarifaZona, setTarifaZona] = useState<number | null>(null);
  const [reglaEnvio, setReglaEnvio] = useState<ReglaEnvioGratis>(() => reglaEnvioGratis(undefined, undefined));
  // El costo sale del subtotal actual del carrito: si cambian los productos no hace falta volver a consultar la zona
  const costoEnvio = zonaEnvio && tarifaZona !== null ? calcularEnvioFinal(subtotal, tarifaZona, reglaEnvio) : null;
  const [cargandoGps, setCargandoGps] = useState(false);
  const [mensajeGps, setMensajeGps] = useState<string | null>(null);
  const [origenPunto, setOrigenPunto] = useState<'GPS' | 'MAPA'>('GPS');
  const [ubicacionConfirmada, setUbicacionConfirmada] = useState(false);
  // Libreta del cliente con cuenta: direcciones anteriores (solo se usa en delivery)
  const [direccionesAnteriores, setDireccionesAnteriores] = useState<DireccionCliente[] | null>(null);
  // null = aún no elige; 'nueva' = otra dirección; id = una de la libreta
  const [opcionDireccion, setOpcionDireccion] = useState<string | 'nueva' | null>(null);
  const [eligiendoDireccion, setEligiendoDireccion] = useState(false);
  const [avisoDireccion, setAvisoDireccion] = useState<string | null>(null);
  // Sin cuenta con celular: pista enmascarada de la dirección del último pedido (la completa la pone el servidor)
  const [pistaDireccion, setPistaDireccion] = useState<{ zona: string | null; direccion: string | null } | null>(null);
  const [usarUltimaDireccion, setUsarUltimaDireccion] = useState(false);

  // Comprobante (Boleta o Factura)
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('BOLETA');
  const [dni, setDni] = useState('');
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');

  // Medio de pago
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('YAPE');
  const [pagaCon, setPagaCon] = useState('');
  const [copiadoKey, setCopiadoKey] = useState<string | null>(null);

  // Estado de envío
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Cupón
  const [cuponCodigo, setCuponCodigo] = useState('');
  const [cuponAplicado, setCuponAplicado] = useState<{
    codigo: string;
    descripcion: string;
    descuentoCalculado: number;
    tipo: string;
    valor: number;
  } | null>(null);
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [puntosAplicados, setPuntosAplicados] = useState(0);
  const [promos, setPromos] = useState<{ total: number; canjeable: number | null; puntosEstimados: number | null; porcentaje: number | null; detalles: { tipo?: string; nombre: string; monto: number }[] }>({ total: 0, canjeable: null, puntosEstimados: null, porcentaje: null, detalles: [] });
  const cuentaCtx = useCuentaOpcional();
  const clienteCuenta = cuentaCtx?.cliente ?? null;
  const cumpleFaltaCuenta = !!clienteCuenta && (!clienteCuenta.cumpleanos || clienteCuenta.cumpleanos === '—');
  const pideCumple = cumpleFaltaCuenta;
  // Acceso: con sesión se usa la cuenta; sin ella el cliente elige ingresar o seguir como invitado
  const [comoInvitado, setComoInvitado] = useState(false);
  // Sin invitado permitido, quien pide sin cuenta debe escribir su celular (así suma puntos): no se ofrece «invitado»
  const invitadoPermitido = datosLocal?.invitadoPermitido === true;
  const [verPuntos, setVerPuntos] = useState(false);
  // Con sesión el pedido usa el nombre y el teléfono de la cuenta; el teléfono puede cambiarse solo para este pedido
  const [otroTelefono, setOtroTelefono] = useState(false);
  useEffect(() => {
    if (!clienteCuenta) return;
    setNombre(clienteCuenta.nombre);
    if (clienteCuenta.telefono && !otroTelefono) setTelefono(clienteCuenta.telefono);
  }, [clienteCuenta, otroTelefono]);
  // Sin cuenta, con un celular completo: pedimos la pista de la dirección anterior (sin dirección completa)
  const tieneCuenta = Boolean(clienteCuenta);
  useEffect(() => {
    setPistaDireccion(null);
    setUsarUltimaDireccion(false);
    const tel = telefono.trim();
    if (tieneCuenta || !/^9\d{8}$/.test(tel)) return;
    let vigente = true;
    api
      .post<{ existe?: boolean; zona?: string | null; direccion?: string | null }>('/pedidos/pista-direccion', { telefono: tel })
      .then((r) => {
        if (vigente && r?.existe) setPistaDireccion({ zona: r.zona ?? null, direccion: r.direccion ?? null });
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [telefono, tieneCuenta]);
  const [mensajeCupon, setMensajeCupon] = useState<string | null>(null);
  // Promoción de primera compra (solo con sesión iniciada): se muestra a quien no ha entrado a su cuenta
  const [primeraCompra, setPrimeraCompra] = useState<{ nombre: string; descuento: string } | null>(null);

  // Idempotency-Key único por intento
  const claveIdempotenciaRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  );

  // Prevención de doble toque estricta
  const peticionEnCursoRef = useRef(false);

  // Datos y coordenadas de la tienda física
  const tiendaCoords = {
    lat: datosLocal?.lat ?? SEDE_DEFECTO.lat,
    lng: datosLocal?.lng ?? SEDE_DEFECTO.lng,
    nombre: datosLocal?.nombre ?? SEDE_DEFECTO.nombre,
    direccion: datosLocal?.direccion ?? SEDE_DEFECTO.direccion,
  };

  // lo que descontará el servidor (promociones automáticas y cupón), para mostrar el mismo total que se cobra
  const tieneSesion = Boolean(clienteCuenta);
  const clavePromos = JSON.stringify([lineas.map((l) => [l.productoId, l.cantidad, l.subtotal]), cuponAplicado?.codigo, tieneSesion]);
  useEffect(() => {
    if (!checkoutAbierto || lineas.length === 0) return;
    let vigente = true;
    api
      .post<{ descuentoTotal: number; montoCanjeable?: number; puntosEstimados?: number; puntosPorcentaje?: number; detalles: { tipo?: string; nombre: string; monto: number }[] }>('/carta/descuentos/vista-previa', {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, subtotal: l.subtotal, precioUnitario: l.precioUnitario })),
        cuponCodigo: cuponAplicado?.codigo,
      })
      .then((r) => vigente && setPromos({ total: Number(r?.descuentoTotal) || 0, canjeable: typeof r?.montoCanjeable === 'number' ? r.montoCanjeable : null, puntosEstimados: typeof r?.puntosEstimados === 'number' ? r.puntosEstimados : null, porcentaje: typeof r?.puntosPorcentaje === 'number' ? r.puntosPorcentaje : null, detalles: Array.isArray(r?.detalles) ? r.detalles : [] }))
      .catch(() => vigente && setPromos({ total: 0, canjeable: null, puntosEstimados: null, porcentaje: null, detalles: [] }));
    return () => {
      vigente = false;
    };
  }, [checkoutAbierto, clavePromos]);

  // Sin sesión: se avisa que la primera compra se aplica al iniciar sesión (la validación real es del servidor)
  useEffect(() => {
    if (!checkoutAbierto || tieneSesion) return;
    let vigente = true;
    api
      .get<OfertaItem[]>('/carta/ofertas')
      .then((r) => {
        const oferta = (Array.isArray(r) ? r : []).find((o) => o.soloPrimeraCompra && o.vigenteAhora);
        if (vigente) {
          setPrimeraCompra(oferta ? { nombre: oferta.nombre, descuento: oferta.descuentoTipo === 'MONTO' ? `S/ ${oferta.descuentoValor ?? 0}` : `${oferta.descuentoValor ?? 0} %` } : null);
        }
      })
      .catch(() => vigente && setPrimeraCompra(null));
    return () => {
      vigente = false;
    };
  }, [checkoutAbierto, tieneSesion]);

  // Direcciones guardadas del cliente con cuenta; si falla, se sigue como sin libreta
  const clientePartyId = clienteCuenta?.partyId ?? null;
  useEffect(() => {
    if (!checkoutAbierto || !clientePartyId) return;
    let vigente = true;
    api
      .get<{ direcciones: DireccionCliente[] }>('/carta/cuenta/direcciones')
      .then((r) => vigente && setDireccionesAnteriores(Array.isArray(r?.direcciones) ? r.direcciones : []))
      .catch(() => vigente && setDireccionesAnteriores([]));
    return () => {
      vigente = false;
    };
  }, [checkoutAbierto, clientePartyId]);

  if (!checkoutAbierto) return null;

  // Con cuenta y direcciones guardadas (o cargando) hay que elegir a dónde se envía antes de ver el formulario
  const pideEleccionDireccion =
    Boolean(clienteCuenta) && opcionDireccion === null && (direccionesAnteriores === null || direccionesAnteriores.length > 0);

  // Cálculo del total
  const costoEnvioEfectivo = modalidad === 'DELIVERY' ? costoEnvio : 0;
  const resumenEnvio =
    modalidad === 'DELIVERY' && zonaEnvio && tarifaZona !== null
      ? textoResumenEnvio(zonaEnvio, tarifaZona, subtotal, reglaEnvio)
      : null;
  const descuentoCupon = cuponAplicado ? cuponAplicado.descuentoCalculado : 0;
  // Descuentos del servidor (promociones + cupón). El cupón se muestra aparte; lo demás son promociones.
  const descuentosServidor = promos.total > 0 ? promos.total : descuentoCupon;
  const promoMonto = Math.max(0, Math.round((descuentosServidor - descuentoCupon) * 100) / 100);
  const puntosMonto = cuponAplicado ? 0 : puntosAplicados;
  const totalCalculado = Math.max(
    0,
    Number((calcularTotalPedido({ subtotal, envio: costoEnvioEfectivo }) - promoMonto - descuentoCupon - puntosMonto).toFixed(2)),
  );

  const aplicarCupon = async () => {
    if (!cuponCodigo.trim()) return;
    setCargandoCupon(true);
    setMensajeCupon(null);
    try {
      const res = await api.post<any>('/carta/cupon/validar', {
        codigo: cuponCodigo.trim().toUpperCase(),
        subtotal,
        canal: 'CARTA',
      });
      if (res && res.cupon) {
        setCuponAplicado({
          codigo: res.cupon.codigoBase || cuponCodigo.trim().toUpperCase(),
          descripcion: res.cupon.descripcion || 'Descuento aplicado',
          descuentoCalculado: Number(res.cupon.descuentoCalculado || 0),
          tipo: res.cupon.tipo,
          valor: Number(res.cupon.valor),
        });
        setMensajeCupon(`Cupón aplicado: ${res.cupon.descripcion || ''}.`);
      }
    } catch (err: any) {
      setCuponAplicado(null);
      setMensajeCupon(err.response?.data?.mensaje || err.message || 'Código de cupón no válido');
    } finally {
      setCargandoCupon(false);
    }
  };

  const removerCupon = () => {
    setCuponAplicado(null);
    setCuponCodigo('');
    setMensajeCupon(null);
  };

  // Copiar al portapapeles
  const copiarTexto = async (texto: string, clave: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setCopiadoKey(clave);
        setTimeout(() => setCopiadoKey(null), 2000);
      }
    } catch {
      // Ignorar fallo de portapapeles
    }
  };

  // Fija el punto de entrega (GPS, búsqueda o toque en el mapa) y consulta la zona y el envío.
  // Devuelve false solo si el punto quedó fuera de la zona de reparto.
  const fijarPunto = async (lat: number, lng: number, origen: 'GPS' | 'MAPA', precisionM?: number): Promise<boolean> => {
    const avisoPrecision =
      precisionM && precisionM > 150
        ? ` Tu equipo la calculó de forma aproximada (±${precisionM >= 1000 ? `${(precisionM / 1000).toFixed(1)} km` : `${Math.round(precisionM)} m`}): mueve el punto rojo hasta tu puerta.`
        : '';
    setCoordenadas({ lat, lng });
    setOrigenPunto(origen);
    setUbicacionConfirmada(false);

    try {
      const res = await api.get<ConsultaEnvioRespuesta>(`/carta/envio?lat=${lat}&lng=${lng}`);

      if (!res.cubierto) {
        setZonaEnvio(null);
        setTarifaZona(null);
        setMensajeGps(`FUERA_DE_COBERTURA: Tu ubicación está fuera de la zona de reparto.${avisoPrecision}`);
        return false;
      } else {
        setZonaEnvio(res.zona);
        setTarifaZona(res.tarifaZona);
        setReglaEnvio(reglaEnvioGratis(res.gratisDesde, res.modoGratis));
        setMensajeGps(`Ubicación encontrada.${avisoPrecision}`);
      }
    } catch {
      setMensajeGps('No se pudo verificar la zona de envío. Se coordinará por WhatsApp.');
      setZonaEnvio(null);
      setTarifaZona(null);
    }
    return true;
  };

  // Elige una dirección de la libreta: rellena los campos y consulta zona y envío como si se hubiera marcado en el mapa
  const elegirDireccionAnterior = async (d: DireccionCliente) => {
    setAvisoDireccion(null);
    setErrorPaso(null);
    setEligiendoDireccion(true);
    setOpcionDireccion(d.id);
    setDireccion(d.direccion);
    setReferencia(d.referencia ?? '');
    setUbicacionConfirmada(false);
    setMensajeGps(null);
    const lat = d.lat == null ? Number.NaN : Number(d.lat);
    const lng = d.lng == null ? Number.NaN : Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCoordenadas(null);
      setZonaEnvio(null);
      setTarifaZona(null);
    } else {
      const cubierto = await fijarPunto(lat, lng, 'MAPA');
      if (!cubierto) {
        // Fuera de zona: se vuelve a preguntar y no queda nada de esa dirección
        setOpcionDireccion(null);
        setDireccion('');
        setReferencia('');
        setCoordenadas(null);
        setZonaEnvio(null);
        setTarifaZona(null);
        setMensajeGps(null);
        setAvisoDireccion('Esa dirección quedó fuera de nuestra zona de reparto. Elige otra o indica una nueva.');
      }
    }
    setEligiendoDireccion(false);
  };

  // Dirección nueva: limpia lo que hubiera de una anterior
  const elegirDireccionNueva = () => {
    setAvisoDireccion(null);
    setOpcionDireccion('nueva');
    setDireccion('');
    setReferencia('');
    setCoordenadas(null);
    setZonaEnvio(null);
    setTarifaZona(null);
    setUbicacionConfirmada(false);
    setMensajeGps(null);
  };

  // Geolocalización
  const obtenerUbicacionGps = () => {
    if (!navigator.geolocation) {
      setMensajeGps('Tu navegador no soporta geolocalización');
      return;
    }

    setCargandoGps(true);
    setMensajeGps('Obteniendo tu ubicación...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fijarPunto(pos.coords.latitude, pos.coords.longitude, 'GPS', pos.coords.accuracy);
        setCargandoGps(false);
      },
      () => {
        setCargandoGps(false);
        setMensajeGps('No fue posible conseguir la ubicación. Escribe tu dirección o márcala en el mapa.');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // Dirección del último pedido de este celular: el servidor la toma; aquí solo se marca y se limpia el mapa
  const usarDireccionDelUltimoPedido = () => {
    setUsarUltimaDireccion(true);
    setDireccion('');
    setReferencia('');
    setCoordenadas(null);
    setUbicacionConfirmada(false);
    setZonaEnvio(null);
    setTarifaZona(null);
  };

  // Pedido mínimo: solo para DELIVERY, sobre el subtotal de productos. Sin parámetro configurado no hay mínimo.
  const minimoDelivery = datosLocal?.pedidoMinimo && datosLocal.pedidoMinimo > 0 ? datosLocal.pedidoMinimo : 0;
  const faltanteMinimo =
    modalidad === 'DELIVERY' && minimoDelivery > 0 && subtotal < minimoDelivery
      ? Number((minimoDelivery - subtotal).toFixed(2))
      : 0;
  const mensajeMinimo = `Pedido mínimo de delivery S/ ${minimoDelivery.toFixed(2)}. Te faltan S/ ${faltanteMinimo.toFixed(2)}`;

  // Validaciones del formulario separadas por apartado
  const validarPaso1 = (): string | null => {
    if (!clienteCuenta && !comoInvitado && invitadoPermitido) {
      return 'Elige si ingresas con tu cuenta o continúas como invitado';
    }
    if (!nombre.trim()) {
      return 'El nombre es obligatorio';
    }
    const telLimpio = telefono.trim();
    if (telLimpio && !/^9\d{8}$/.test(telLimpio)) {
      return 'El teléfono debe tener 9 dígitos y empezar con 9';
    }
    if (!telLimpio) {
      // Con cuenta el celular es obligatorio; como invitado solo si el dueño no permite pedir sin celular
      if (clienteCuenta) return 'El teléfono debe tener 9 dígitos y empezar con 9';
      if (!invitadoPermitido) return 'Escribe tu celular para hacer tu pedido y sumar puntos';
    }
    if (!clienteCuenta && telLimpio && nombre.trim().length < 2) return 'Escribe tu nombre completo para sumar puntos con tu celular';
    return null;
  };

  const validarPaso2 = (): string | null => {
    if (modalidad === 'DELIVERY') {
      if (faltanteMinimo > 0) return mensajeMinimo;
      if (usarUltimaDireccion) return null;
      if (pideEleccionDireccion) {
        return 'Elige a dónde lo enviamos: una de tus direcciones anteriores o una nueva';
      }
      if (!coordenadas && direccion.trim().length < 5) {
        return 'Para delivery debes indicar una dirección de al menos 5 caracteres o usar tu ubicación';
      }
      if (coordenadas && !ubicacionConfirmada) {
        return 'Confirma con «Mi pedido llega aquí» que el punto rojo es donde recibirás tu pedido';
      }
    }
    return null;
  };

  const validarPaso3 = (): string | null => {
    if (tipoComprobante === 'FACTURA') {
      const rucLimpio = ruc.trim();
      if (!/^\d{11}$/.test(rucLimpio)) {
        return 'Para factura se exige un RUC válido de 11 dígitos (un RUC de 10 dígitos no se acepta)';
      }
      if (!razonSocial.trim()) {
        return 'Para factura se exige la razón social';
      }
    } else if (tipoComprobante === 'BOLETA') {
      const dniLimpio = dni.trim();
      if (dniLimpio && !/^\d{8}$/.test(dniLimpio)) {
        return 'El DNI debe tener 8 dígitos numéricos';
      }
    }

    if (metodoPago === 'EFECTIVO' && pagaCon.trim()) {
      const pagaConNum = Number(pagaCon);
      if (isNaN(pagaConNum) || pagaConNum < totalCalculado) {
        return `El monto con el que pagas (S/ ${pagaCon}) no puede ser menor al total (S/ ${totalCalculado.toFixed(2)})`;
      }
    }

    return null;
  };

  const validarPaso = (num: 1 | 2 | 3): string | null => {
    if (num === 1) return validarPaso1();
    if (num === 2) return validarPaso2();
    if (num === 3) return validarPaso3();
    return null;
  };

  const hacerScrollArriba = () => {
    if (!contenidoRef.current) return;
    if (typeof contenidoRef.current.scrollTo === 'function') {
      contenidoRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      contenidoRef.current.scrollTop = 0;
    }
  };

  const avanzarPaso = () => {
    const error = validarPaso(paso);
    if (error) {
      setErrorPaso(error);
      return;
    }
    setErrorPaso(null);
    const siguiente = (paso + 1) as 2 | 3;
    setPaso(siguiente);
    setPasoMaximo((prev) => Math.max(prev, siguiente) as 1 | 2 | 3);
    hacerScrollArriba();
  };

  const retrocederPaso = () => {
    setErrorPaso(null);
    setPaso((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : 1));
    hacerScrollArriba();
  };

  const esCompletado = (num: 1 | 2 | 3): boolean => {
    if (num === paso) return false;
    if (num < paso) return true;
    if (num === 1) return validarPaso1() === null && pasoMaximo >= 2;
    if (num === 2) return validarPaso1() === null && validarPaso2() === null && pasoMaximo >= 3;
    return false;
  };

  const irAPaso = (nuevoPaso: 1 | 2 | 3) => {
    if (nuevoPaso === paso) return;
    if (nuevoPaso < paso) {
      setErrorPaso(null);
      setPaso(nuevoPaso);
      hacerScrollArriba();
      return;
    }
    // Para avanzar a un paso superior, validar los anteriores
    for (let p = paso; p < nuevoPaso; p++) {
      const err = validarPaso(p as 1 | 2 | 3);
      if (err) {
        setErrorPaso(err);
        return;
      }
    }
    setErrorPaso(null);
    setPaso(nuevoPaso);
    setPasoMaximo((prev) => Math.max(prev, nuevoPaso) as 1 | 2 | 3);
    hacerScrollArriba();
  };

  // Enviar pedido a la API
  const enviarPedido = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (peticionEnCursoRef.current || enviando) {
      return;
    }

    if (estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda)) {
      setErrorEnvio('La carta se encuentra cerrada o en pausa: no se pueden enviar pedidos.');
      return;
    }

    const err1 = validarPaso1();
    if (err1) {
      setPaso(1);
      setErrorPaso(err1);
      return;
    }
    const err2 = validarPaso2();
    if (err2) {
      setPaso(2);
      setErrorPaso(err2);
      return;
    }
    const err3 = validarPaso3();
    if (err3) {
      setPaso(3);
      setErrorPaso(err3);
      return;
    }

    setErrorPaso(null);
    setErrorEnvio(null);
    setEnviando(true);
    peticionEnCursoRef.current = true;

    const lineasDto: any[] = [];
    for (const lin of lineas) {
      if (lin.unidades && lin.unidades.length > 1) {
        for (const u of lin.unidades) {
          lineasDto.push({
            productoId: lin.productoId,
            tamanoId: lin.tamanoId,
            cantidad: 1,
            opciones: u.opciones.map((o) => o.id),
            personas: u.persona?.trim() ? [u.persona.trim()] : [nombre.trim()],
            nota: lin.nota,
            ofertaId: lin.ofertaId,
            comboElecciones: lin.comboElecciones,
          });
        }
      } else {
        lineasDto.push({
          productoId: lin.productoId,
          tamanoId: lin.tamanoId,
          cantidad: lin.cantidad,
          opciones: (lin.opciones || []).map((o) => o.id),
          personas: lin.personas && lin.personas.length > 0 ? lin.personas : [nombre.trim()],
          nota: lin.nota,
          ofertaId: lin.ofertaId,
          comboElecciones: lin.comboElecciones,
        });
      }
    }

    const payload = {
      cliente: {
        nombre: nombre.trim(),
        ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
        ...(pideCumple && cumpleCliente ? { cumpleanos: cumpleCliente } : {}),
      },
      modalidad,
      entrega:
        modalidad === 'DELIVERY'
          ? usarUltimaDireccion
            ? { reutilizarUltimaDireccion: true }
            : {
                direccion: direccion.trim() || undefined,
                referencia: referencia.trim() || undefined,
                lat: coordenadas?.lat,
                lng: coordenadas?.lng,
                origen: coordenadas ? origenPunto : ('ESCRITA' as const),
              }
          : undefined,
      lineas: lineasDto,
      pago: {
        metodo: metodoPago,
        pagaCon:
          metodoPago === 'EFECTIVO' && pagaCon.trim() ? Number(pagaCon) : undefined,
      },
      comprobante: {
        tipo: tipoComprobante,
        dni: tipoComprobante === 'BOLETA' && dni.trim() ? dni.trim() : undefined,
        ruc: tipoComprobante === 'FACTURA' ? ruc.trim() : undefined,
        razonSocial: tipoComprobante === 'FACTURA' ? razonSocial.trim() : undefined,
      },
      cuponCodigo: cuponAplicado ? cuponAplicado.codigo : undefined,
      puntosCanje: !cuponAplicado && puntosAplicados > 0 ? puntosAplicados : undefined,
    };

    try {
      const respuesta = await api.post<any>('/pedidos', payload, {
        headers: {
          'Idempotency-Key': claveIdempotenciaRef.current,
        },
      });

      limpiarCarrito();
      cerrarCheckout();
      void cuentaCtx?.refrescar();
      guardarPedido({
        codigo: respuesta.codigo,
        token: respuesta.seguimientoToken,
        modalidad,
        nombre: nombre.trim(),
        creadoEn: new Date().toISOString(),
      });
      setPedidoConfirmado({
        id: respuesta.id,
        codigo: respuesta.codigo,
        estado: respuesta.estado,
        subtotal: respuesta.subtotal,
        envio: respuesta.envio,
        total: respuesta.total,
        mensaje: respuesta.mensaje,
        clienteNombre: nombre.trim(),
        modalidad,
        seguimientoToken: respuesta.seguimientoToken,
      });
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'PRODUCTO_AGOTADO') {
          setErrorEnvio(err.message || 'Uno de los productos seleccionados se encuentra agotado.');
        } else if (err.codigo === 'COMBO_PARTE_NO_DISPONIBLE') {
          setErrorEnvio(`${err.message} Tu carrito sigue igual: quita el combo y vuelve a agregarlo para elegir otro reemplazo.`);
        } else if (err.codigo === 'CARTA_CERRADA') {
          setErrorEnvio('La carta se encuentra cerrada. No es posible enviar pedidos ahora.');
        } else if (err.codigo === 'FUERA_DE_COBERTURA') {
          setErrorEnvio('La dirección indicada está fuera de nuestra zona de cobertura.');
        } else if (err.codigo === 'CELULAR_REQUERIDO') {
          setPaso(1);
          setErrorEnvio('Escribe tu celular para hacer tu pedido y sumar puntos.');
        } else if (err.codigo === 'PEDIDO_MINIMO') {
          // El servidor manda el mensaje con el faltante; se muestra tal cual y se vuelve a los datos de entrega
          setPaso(2);
          setErrorEnvio(err.message);
        } else if (err.codigo === 'FACTURA_DATOS_INCOMPLETOS') {
          setErrorEnvio('La factura exige un RUC de 11 dígitos y razón social válida.');
        } else {
          setErrorEnvio(err.message || 'Error al procesar el pedido.');
        }
      } else {
        setErrorEnvio(err instanceof Error ? err.message : 'Error inesperado al enviar el pedido.');
      }
    } finally {
      setEnviando(false);
      peticionEnCursoRef.current = false;
    }
  };

  const pctPuntos = promos.porcentaje ?? datosLocal?.puntosPorcentaje ?? 5;
  // misma base que el servidor: productos sin promoción, menos lo pagado con puntos; con cupón no suma
  const puntosEstimados = estimarPuntos({ canjeable: promos.canjeable, porcentaje: pctPuntos, puntosAplicados, conCupon: !!cuponAplicado, delServidor: promos.puntosEstimados });
  const textoPuntos = `Con tu cuenta ganas el ${pctPuntos} % de lo que pagas en puntos, y no vencen. Los usas como descuento en tus próximos pedidos, solo en productos sin promoción ni descuento.`;

  const mediosPagoDisponibles = datosLocal?.mediosPago || {
    yape: { activo: true, numero: '123456789' },
    plin: { activo: true, numero: '123456789' },
    efectivo: { activo: true },
    tarjeta: { activo: true },
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tus datos y el pago"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          backgroundColor: 'rgba(11, 44, 62, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 'min(580px, 100%)',
            maxHeight: '92vh',
            backgroundColor: 'var(--cp-cream)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Cabecera */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--cp-white)',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '20px',
                color: 'var(--cp-navy)',
                margin: 0,
              }}
            >
              Tus datos y el pago
            </h2>
            <button
              onClick={cerrarCheckout}
              aria-label="Cerrar formulario de pedido"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '20px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          {/* Indicador de pasos arriba, fijo debajo del título */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--cp-white)',
              borderBottom: '1px solid var(--cp-line)',
              position: 'relative',
            }}
          >
            {/* Línea conectora entre círculos */}
            <div
              style={{
                position: 'absolute',
                top: '28px',
                left: 'calc(16.66% + 15px)',
                right: 'calc(16.66% + 15px)',
                height: '2px',
                backgroundColor: 'var(--cp-line)',
                zIndex: 0,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {[
                { num: 1 as const, nombre: 'Tus datos' },
                { num: 2 as const, nombre: 'Ubicación' },
                { num: 3 as const, nombre: 'Pago' },
              ].map((item) => {
                const activo = paso === item.num;
                const completado = esCompletado(item.num);
                const navegable = completado || item.num < paso;

                return (
                  <button
                    key={item.num}
                    type="button"
                    disabled={!navegable}
                    onClick={() => navegable && irAPaso(item.num)}
                    aria-current={activo ? 'step' : undefined}
                    aria-label={`Paso ${item.num}: ${item.nombre}${completado ? ' (completado)' : activo ? ' (actual)' : ''}`}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: navegable ? 'pointer' : 'default',
                      gap: '6px',
                      textDecoration: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '14px',
                        backgroundColor: activo
                          ? 'var(--cp-orange)'
                          : completado
                          ? 'var(--cp-sand)'
                          : 'var(--cp-white)',
                        color: activo
                          ? '#FFFFFF'
                          : completado
                          ? 'var(--cp-navy)'
                          : 'var(--cp-soft)',
                        border: activo
                          ? '2px solid var(--cp-orange)'
                          : completado
                          ? '2px solid var(--cp-navy)'
                          : '2px solid var(--cp-line)',
                        boxShadow: activo ? '0 2px 6px rgba(230,121,41,0.35)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {completado ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        item.num
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: activo ? 800 : 700,
                        color: activo
                          ? 'var(--cp-orange)'
                          : completado
                          ? 'var(--cp-navy)'
                          : 'var(--cp-soft)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulario y contenido de apartados */}
          <form
            onSubmit={enviarPedido}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {/* Contenido scrolleable del apartado activo */}
            <div
              ref={contenidoRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* ================= APARTADO 1: TUS DATOS ================= */}
              {paso === 1 && (
                <>
                  {/* Modalidad de entrega */}
                  <div
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid var(--cp-line)',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 700,
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      ¿Cómo deseas recibir tu pedido?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setModalidad('DELIVERY')}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          borderRadius: '10px',
                          border:
                            modalidad === 'DELIVERY'
                              ? '2px solid var(--cp-orange)'
                              : '1.5px solid var(--cp-line)',
                          backgroundColor:
                            modalidad === 'DELIVERY' ? 'var(--cp-sand)' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '14px',
                        }}
                      >
                        Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalidad('RECOGER')}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          borderRadius: '10px',
                          border:
                            modalidad === 'RECOGER'
                              ? '2px solid var(--cp-orange)'
                              : '1.5px solid var(--cp-line)',
                          backgroundColor:
                            modalidad === 'RECOGER' ? 'var(--cp-sand)' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '14px',
                        }}
                      >
                        Recoger en el local
                      </button>
                    </div>
                  </div>

                  {/* Acceso (cuenta o invitado) */}
                  {!clienteCuenta && !comoInvitado && invitadoPermitido && (
                    <div
                      style={{
                        backgroundColor: 'var(--cp-white)',
                        padding: '14px',
                        borderRadius: '14px',
                        border: '1px solid var(--cp-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: '14px' }}>
                        ¿Cómo quieres continuar?
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                        Tus puntos se suman con tu celular, sin contraseña. Ingresa solo si quieres ver tus puntos, o sigue como invitado.
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => cuentaCtx?.abrirPanel()}
                          style={{
                            flex: '1 1 160px',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--cp-navy)',
                            color: 'var(--cp-white)',
                            fontWeight: 800,
                            fontSize: '14px',
                          }}
                        >
                          Ver mis puntos
                        </button>
                        <button
                          type="button"
                          onClick={() => setComoInvitado(true)}
                          style={{
                            flex: '1 1 160px',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-navy)',
                            backgroundColor: 'var(--cp-white)',
                            color: 'var(--cp-navy)',
                            fontWeight: 800,
                            fontSize: '14px',
                          }}
                        >
                          Continuar como invitado
                        </button>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setVerPuntos((v) => !v)}
                          aria-expanded={verPuntos}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          ¿Cómo funcionan los puntos?
                        </button>
                        {verPuntos && (
                          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '17px' }}>
                            {textoPuntos} Como invitado no se acumulan puntos.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Datos de contacto */}
                  {(clienteCuenta || comoInvitado || !invitadoPermitido) && (
                    <div
                      style={{
                        backgroundColor: 'var(--cp-white)',
                        padding: '14px',
                        borderRadius: '14px',
                        border: '1px solid var(--cp-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        Tus datos de contacto
                      </div>

                      {clienteCuenta ? (
                        <div style={{ fontSize: '13px' }}>
                          Pides con la cuenta de <b>{clienteCuenta.nombre}</b>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                          {invitadoPermitido
                            ? 'Sigues como invitado: solo necesitamos tu nombre. Como invitado no se suman puntos.'
                            : 'Tus puntos se suman con tu celular, sin contraseña. Solo necesitamos tu nombre y tu celular. ¿Quieres verlos?'}{' '}
                          <button type="button" onClick={() => cuentaCtx?.abrirPanel()} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}>
                            Ver mis puntos
                          </button>{' '}
                          <button type="button" onClick={() => setVerPuntos((v) => !v)} aria-expanded={verPuntos} aria-label="¿Cómo funcionan los puntos?" style={{ width: 20, height: 20, minWidth: 20, minHeight: 20, borderRadius: 10, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontSize: '11px', fontWeight: 800, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>?</button>
                          {verPuntos && (
                            <div style={{ marginTop: '6px', lineHeight: '17px' }}>
                              {textoPuntos}
                            </div>
                          )}
                        </div>
                      )}

                      {!clienteCuenta && (
                      <div>
                        <label
                          htmlFor="f-nombre"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Nombre completo
                        </label>
                        <input
                          id="f-nombre"
                          type="text"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Tu nombre y apellido"
                          required
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-cream)',
                            color: 'var(--cp-navy)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                      </div>
                      )}

                      {clienteCuenta && clienteCuenta.telefono && !otroTelefono ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
                          <span>
                            Te contactamos al <b>{clienteCuenta.telefono}</b>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setOtroTelefono(true); setTelefono(''); }}
                            style={{ background: 'none', border: 'none', padding: 0, minHeight: 'auto', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            Usar otro número para este pedido
                          </button>
                        </div>
                      ) : (
                        <>
                      <div>
                        <label
                          htmlFor="f-tel"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Teléfono celular (9 dígitos)
                        </label>
                        <input
                          id="f-tel"
                          type="tel"
                          inputMode="numeric"
                          maxLength={9}
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ej.: 987654321"
                          required={!invitadoPermitido}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-cream)',
                            color: 'var(--cp-navy)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                          {invitadoPermitido
                            ? 'Opcional. Con tu celular sumas puntos.'
                            : 'Tu celular: sumas puntos con tu número, sin contraseña.'}
                        </div>
                      </div>
                          {clienteCuenta && otroTelefono && clienteCuenta.telefono && (
                            <button
                              type="button"
                              onClick={() => setOtroTelefono(false)}
                              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, minHeight: 'auto', fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              Usar mi número guardado ({clienteCuenta.telefono})
                            </button>
                          )}
                        </>
                      )}

                      {pideCumple && (
                        <div>
                          <label
                            htmlFor="f-cumple"
                            style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', display: 'block', marginBottom: '4px' }}
                          >
                            Tu cumpleaños, para saludarte
                          </label>
                          <input
                            id="f-cumple"
                            type="date"
                            value={cumpleCliente}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setCumpleCliente(e.target.value)}
                            required
                            aria-required="true"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-cream)',
                              color: 'var(--cp-navy)',
                              padding: '0 12px',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ================= APARTADO 2: UBICACIÓN ================= */}
              {paso === 2 && (
                <>
                  {modalidad === 'DELIVERY' ? (
                    <>
                    {pideEleccionDireccion && (
                      <SelectorDireccionesCliente
                        direcciones={direccionesAnteriores}
                        ocupado={eligiendoDireccion}
                        aviso={avisoDireccion}
                        alElegir={(d) => void elegirDireccionAnterior(d)}
                        alNueva={elegirDireccionNueva}
                      />
                    )}
                    {!clienteCuenta && pistaDireccion && (
                      <div
                        style={{
                          backgroundColor: 'var(--cp-white)',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          border: '1px solid var(--cp-line)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {usarUltimaDireccion ? (
                          <>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>Enviaremos a la dirección de tu último pedido</div>
                            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                              {[pistaDireccion.direccion, pistaDireccion.zona ? `zona ${pistaDireccion.zona}` : null].filter(Boolean).join(' · ')}
                            </div>
                            <button
                              type="button"
                              onClick={() => setUsarUltimaDireccion(false)}
                              style={{ alignSelf: 'flex-start', minHeight: '44px', background: 'none', border: 'none', padding: '0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              Usar otra dirección
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={usarDireccionDelUltimoPedido}
                              style={{ minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-navy)', backgroundColor: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px' }}
                            >
                              Usar la dirección de mi último pedido
                            </button>
                            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                              {[pistaDireccion.direccion, pistaDireccion.zona ? `zona ${pistaDireccion.zona}` : null].filter(Boolean).join(' · ')}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {!pideEleccionDireccion && !usarUltimaDireccion && (
                    <div
                      style={{
                        backgroundColor: 'var(--cp-white)',
                        padding: '16px',
                        borderRadius: '14px',
                        border: '1px solid var(--cp-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        Ubicación para delivery
                      </div>

                      {clienteCuenta && direccionesAnteriores && direccionesAnteriores.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpcionDireccion(null)}
                          style={{ alignSelf: 'flex-start', minHeight: '44px', background: 'none', border: 'none', padding: '0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          Elegir otra dirección guardada
                        </button>
                      )}

                      {!(coordenadas && origenPunto === 'GPS') && (
                        <div>
                          <label
                            htmlFor="f-direccion"
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--cp-soft)',
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            Dirección escrita (si no usas tu ubicación actual)
                          </label>
                          <input
                            id="f-direccion"
                            type="text"
                            value={direccion}
                            onChange={(e) => setDireccion(e.target.value)}
                            placeholder="Calle, número, urbanización..."
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-cream)',
                              color: 'var(--cp-navy)',
                              padding: '0 12px',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="f-referencia"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Referencia (opcional)
                        </label>
                        <input
                          id="f-referencia"
                          type="text"
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="Frente al parque, portón blanco..."
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-cream)',
                            color: 'var(--cp-navy)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={obtenerUbicacionGps}
                            disabled={cargandoGps}
                            style={{
                              flex: '1 1 160px',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-navy)',
                              backgroundColor: 'var(--cp-sand)',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            {cargandoGps ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapaCompletoAbierto(true)}
                            style={{
                              flex: '1 1 160px',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-navy)',
                              backgroundColor: 'var(--cp-white)',
                              color: 'var(--cp-navy)',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            Marcar en el mapa
                          </button>
                        </div>

                        {coordenadas && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                              Revisa que el punto rojo sea donde recibirás tu pedido.{' '}
                              <a
                                href={enlaceGoogleMaps(coordenadas.lat, coordenadas.lng)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver en Google Maps
                              </a>
                            </div>
                            <MapaUbicacion
                              punto={coordenadas}
                              local={tiendaCoords}
                              onCambiar={(p) => void fijarPunto(p.lat, p.lng, 'MAPA')}
                              altura={220}
                              ajustarA="punto"
                              etiqueta="Mapa con el punto de entrega: puedes arrastrar el pin para corregirlo"
                            />
                            {ubicacionConfirmada ? (
                              <div
                                role="status"
                                style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}
                              >
                                Ubicación confirmada
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setUbicacionConfirmada(true)}
                                disabled={costoEnvio === null && Boolean(mensajeGps?.includes('FUERA_DE_COBERTURA'))}
                                style={{
                                  minHeight: '44px',
                                  borderRadius: '10px',
                                  border: 'none',
                                  backgroundColor: 'var(--cp-navy)',
                                  color: 'var(--cp-white)',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                }}
                              >
                                Mi pedido llega aquí
                              </button>
                            )}
                          </div>
                        )}

                        {mensajeGps && (
                          <div
                            role="status"
                            style={{
                              fontSize: '12px',
                              lineHeight: '16px',
                              fontWeight: 600,
                              color: mensajeGps.includes('FUERA_DE_COBERTURA')
                                ? 'var(--cp-rust)'
                                : 'var(--cp-green)',
                            }}
                          >
                            {mensajeGps}
                          </div>
                        )}

                        {resumenEnvio && (
                          <div role="status" style={{ fontSize: '12px', lineHeight: '16px', fontWeight: 600, color: 'var(--cp-green)' }}>
                            {resumenEnvio}
                          </div>
                        )}

                        {!coordenadas && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--cp-soft)',
                              fontStyle: 'italic',
                            }}
                          >
                            Si solo escribes la dirección, el costo de envío se confirma por WhatsApp al procesar tu pedido.
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                    </>
                  ) : (
                    /* Modalidad RECOGER: tienda en mapa pequeño de solo lectura con su dirección */
                    <div
                      style={{
                        backgroundColor: 'var(--cp-white)',
                        padding: '16px',
                        borderRadius: '14px',
                        border: '1px solid var(--cp-line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 800,
                          fontSize: '15px',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        Recoges en Caprichos
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--cp-navy)', lineHeight: '18px' }}>
                        <strong>Dirección del local:</strong> {tiendaCoords.direccion}
                      </div>

                      <MapaUbicacion
                        punto={null}
                        local={tiendaCoords}
                        altura={180}
                        soloLectura={true}
                        ajustarA="local"
                        etiqueta="Ubicación de Caprichos para recoger"
                      />

                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                        Te avisaremos cuando tu pedido esté listo para que pases a recogerlo por nuestro local.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ================= APARTADO 3: PAGO ================= */}
              {paso === 3 && (
                <>
                  {/* Comprobante Boleta o Factura (DT-77) */}
                  <div
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid var(--cp-line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      Comprobante de pago
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTipoComprobante('BOLETA')}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          borderRadius: '10px',
                          border:
                            tipoComprobante === 'BOLETA'
                              ? '2px solid var(--cp-orange)'
                              : '1.5px solid var(--cp-line)',
                          backgroundColor:
                            tipoComprobante === 'BOLETA' ? 'var(--cp-sand)' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        Boleta
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoComprobante('FACTURA')}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          borderRadius: '10px',
                          border:
                            tipoComprobante === 'FACTURA'
                              ? '2px solid var(--cp-orange)'
                              : '1.5px solid var(--cp-line)',
                          backgroundColor:
                            tipoComprobante === 'FACTURA' ? 'var(--cp-sand)' : 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        Factura
                      </button>
                    </div>

                    {tipoComprobante === 'BOLETA' ? (
                      <div>
                        <label
                          htmlFor="f-dni"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          DNI (opcional, 8 dígitos)
                        </label>
                        <input
                          id="f-dni"
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                          placeholder="8 dígitos numéricos"
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-cream)',
                            color: 'var(--cp-navy)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '3px' }}>
                          Solo para tu comprobante; no se guarda en tu cuenta.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label
                            htmlFor="f-ruc"
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--cp-soft)',
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            RUC (11 dígitos obligatorio)
                          </label>
                          <input
                            id="f-ruc"
                            type="text"
                            inputMode="numeric"
                            maxLength={11}
                            value={ruc}
                            onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                            placeholder="11 dígitos (ej.: 20123456789)"
                            required
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-cream)',
                              color: 'var(--cp-navy)',
                              padding: '0 12px',
                              fontSize: '14px',
                            }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="f-rs"
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--cp-soft)',
                              display: 'block',
                              marginBottom: '4px',
                            }}
                          >
                            Razón social (obligatorio)
                          </label>
                          <input
                            id="f-rs"
                            type="text"
                            value={razonSocial}
                            onChange={(e) => setRazonSocial(e.target.value)}
                            placeholder="Nombre o razón social de la empresa"
                            required
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              borderRadius: '10px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-cream)',
                              color: 'var(--cp-navy)',
                              padding: '0 12px',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Medio de pago */}
                  <div
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid var(--cp-line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      Medio de pago
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as MetodoPago[]).map(
                        (m) => {
                          const claveConfig = m.toLowerCase();
                          const estaConfigurado =
                            claveConfig === 'efectivo' ||
                            claveConfig === 'tarjeta' ||
                            mediosPagoDisponibles[claveConfig]?.activo !== false;

                          if (!estaConfigurado) return null;

                          const seleccionado = metodoPago === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMetodoPago(m)}
                              style={{
                                minHeight: '44px',
                                padding: '0 14px',
                                borderRadius: '10px',
                                border: seleccionado
                                  ? '2px solid var(--cp-orange)'
                                  : '1.5px solid var(--cp-line)',
                                backgroundColor: seleccionado
                                  ? 'var(--cp-sand)'
                                  : 'var(--cp-white)',
                                color: 'var(--cp-navy)',
                                fontWeight: 700,
                                fontSize: '13px',
                              }}
                            >
                              {m}
                            </button>
                          );
                        },
                      )}
                    </div>

                    {/* Datos copiables del medio de pago */}
                    {(metodoPago === 'YAPE' || metodoPago === 'PLIN') && (
                      <div
                        style={{
                          backgroundColor: 'var(--cp-sand)',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {metodoPago}:{' '}
                            {mediosPagoDisponibles[metodoPago.toLowerCase()]?.numero ||
                              datosLocal?.telefono ||
                              '123456789'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                            Titular: {datosLocal?.nombre || 'Caprichos'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copiarTexto(
                              mediosPagoDisponibles[metodoPago.toLowerCase()]?.numero ||
                                datosLocal?.telefono ||
                                '123456789',
                              'pago-tel',
                            )
                          }
                          style={{
                            minHeight: '36px',
                            padding: '0 10px',
                            border: '1px solid var(--cp-navy)',
                            borderRadius: '8px',
                            backgroundColor: 'var(--cp-white)',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          {copiadoKey === 'pago-tel' ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    )}

                    {metodoPago === 'TRANSFERENCIA' && (
                      <div
                        style={{
                          backgroundColor: 'var(--cp-sand)',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {mediosPagoDisponibles.transferencia?.banco || 'BCP'}
                          </div>
                          <div style={{ fontSize: '12px' }}>
                            Cuenta: {mediosPagoDisponibles.transferencia?.cuenta || '123456789'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copiarTexto(
                              mediosPagoDisponibles.transferencia?.cuenta || '123456789',
                              'pago-cta',
                            )
                          }
                          style={{
                            minHeight: '36px',
                            padding: '0 10px',
                            border: '1px solid var(--cp-navy)',
                            borderRadius: '8px',
                            backgroundColor: 'var(--cp-white)',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          {copiadoKey === 'pago-cta' ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    )}

                    {metodoPago === 'TARJETA' && (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                        Pagas con tarjeta de débito o crédito cuando recibes o recoges tu pedido (pos inalámbrico).
                      </div>
                    )}

                    {metodoPago === 'EFECTIVO' && (
                      <div>
                        <label
                          htmlFor="f-paga-con"
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--cp-soft)',
                            display: 'block',
                            marginBottom: '4px',
                          }}
                        >
                          Paga con (monto en soles)
                        </label>
                        <input
                          id="f-paga-con"
                          type="number"
                          step="0.10"
                          min={totalCalculado}
                          value={pagaCon}
                          onChange={(e) => setPagaCon(e.target.value)}
                          placeholder={`Ej.: ${Math.ceil(totalCalculado / 10) * 10}`}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            backgroundColor: 'var(--cp-cream)',
                            color: 'var(--cp-navy)',
                            padding: '0 12px',
                            fontSize: '14px',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                      Tu pedido pasa directo a cocina. Un asesor te contactará por WhatsApp para coordinar el pago.
                    </div>
                  </div>

                  {/* Campo de cupón / puntos */}
                  {!cuponAplicado && clienteCuenta && (
                    <PuntosCanje
                      totalPedido={Math.max(0, promos.canjeable ?? 0)}
                      puntosAplicados={puntosAplicados}
                      alAplicar={setPuntosAplicados}
                      porcentaje={pctPuntos}
                    />
                  )}

                  {puntosAplicados === 0 && (
                    <div
                      style={{
                        border: '1px solid var(--cp-line)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        backgroundColor: 'var(--cp-white)',
                      }}
                    >
                      <label htmlFor="f-cup" style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>
                        ¿Tienes un cupón? <span style={{ fontWeight: 500, color: 'var(--cp-soft)' }}>(opcional)</span>
                      </label>
                      {!cuponAplicado ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            id="f-cup"
                            type="text"
                            value={cuponCodigo}
                            onChange={(e) => {
                              setCuponCodigo(e.target.value);
                              setMensajeCupon(null);
                            }}
                            placeholder="Código"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              boxSizing: 'border-box',
                              minHeight: '44px',
                              borderRadius: '12px',
                              border: '1.5px solid var(--cp-line)',
                              backgroundColor: 'var(--cp-cream)',
                              color: 'var(--cp-navy)',
                              padding: '0 12px',
                              textTransform: 'uppercase',
                              fontSize: '14px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={aplicarCupon}
                            disabled={cargandoCupon || !cuponCodigo.trim()}
                            style={{
                              minHeight: '44px',
                              padding: '0 16px',
                              border: '1.5px solid var(--cp-navy)',
                              borderRadius: '12px',
                              backgroundColor: 'transparent',
                              color: 'var(--cp-navy)',
                              fontWeight: 800,
                              cursor: cargandoCupon || !cuponCodigo.trim() ? 'not-allowed' : 'pointer',
                              opacity: cargandoCupon || !cuponCodigo.trim() ? 0.6 : 1,
                            }}
                          >
                            {cargandoCupon ? '...' : 'Aplicar'}
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontWeight: 800, color: 'var(--cp-navy)' }}>{cuponAplicado.codigo}</span>
                          <button
                            type="button"
                            onClick={removerCupon}
                            style={{
                              minHeight: '40px',
                              padding: '0 8px',
                              border: 0,
                              backgroundColor: 'transparent',
                              color: 'var(--cp-rust)',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            Quitar cupón
                          </button>
                        </div>
                      )}
                      {mensajeCupon && (
                        <div
                          style={{
                            fontSize: '12px',
                            lineHeight: '17px',
                            fontWeight: 600,
                            color: cuponAplicado ? '#2F7A45' : 'var(--cp-rust)',
                          }}
                        >
                          {mensajeCupon}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Resumen de totales */}
                  <div
                    style={{
                      backgroundColor: 'var(--cp-white)',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid var(--cp-line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>Subtotal productos</span>
                      <span style={{ fontWeight: 700 }}>S/ {subtotal.toFixed(2)}</span>
                    </div>

                    {promoMonto > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                          <span>Promociones y descuentos</span>
                          <span style={{ fontWeight: 700 }}>−S/ {promoMonto.toFixed(2)}</span>
                        </div>
                        {promos.detalles
                          .filter((d) => d.tipo !== 'CUPON' && d.monto > 0)
                          .map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--cp-soft)', paddingLeft: '10px' }}>
                              <span>{d.nombre}</span>
                              <span>−S/ {d.monto.toFixed(2)}</span>
                            </div>
                          ))}
                      </>
                    )}

                    {cuponAplicado && descuentoCupon > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                        <span>Cupón {cuponAplicado.codigo}</span>
                        <span style={{ fontWeight: 700 }}>−S/ {descuentoCupon.toFixed(2)}</span>
                      </div>
                    )}

                    {puntosMonto > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                        <span>Puntos usados</span>
                        <span style={{ fontWeight: 700 }}>−S/ {puntosMonto.toFixed(2)}</span>
                      </div>
                    )}

                    {primeraCompra && !tieneSesion && (
                      <div role="note" style={{ fontSize: '13px', color: 'var(--cp-navy)', background: 'var(--cp-sand)', borderRadius: '8px', padding: '8px 10px', lineHeight: '18px' }}>
                        Tienes {primeraCompra.descuento} de descuento en tu primera compra. Inicia sesión con tu celular para aplicarlo. No aplica a promociones ni combos.
                      </div>
                    )}

                    {modalidad === 'DELIVERY' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>Costo de envío</span>
                        <span style={{ fontWeight: 700 }}>
                          {costoEnvio !== null
                            ? costoEnvio === 0
                              ? 'GRATIS'
                              : `S/ ${costoEnvio.toFixed(2)}`
                            : 'Se confirma por WhatsApp'}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        borderTop: '1px solid var(--cp-line)',
                        paddingTop: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '18px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      <span>Total a pagar</span>
                      <span style={{ color: 'var(--cp-rust)' }}>S/ {totalCalculado.toFixed(2)}</span>
                    </div>

                    {clienteCuenta && (
                      <div data-testid="puntos-estimados" style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                        <b>Con este pedido ganarás ~{puntosEstimados.toFixed(2)} pts</b> (0 si usas cupón o es solo promoción).
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Pie del formulario con total pequeño, error y botones */}
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: 'var(--cp-white)',
                borderTop: '1px solid var(--cp-line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Total pequeño visible en los 3 apartados */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                }}
              >
                <span>Total a pagar:</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-rust)' }}>
                  S/ {totalCalculado.toFixed(2)}
                </span>
              </div>

              {/* Aviso de pedido mínimo (solo delivery): no deja enviar hasta cubrirlo */}
              {faltanteMinimo > 0 && (
                <div
                  role="status"
                  style={{
                    backgroundColor: 'var(--cp-sand)',
                    border: '1.5px solid var(--cp-orange)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                  }}
                >
                  <span>{mensajeMinimo}</span>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--cp-line)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (subtotal / minimoDelivery) * 100).toFixed(0)}%`,
                        backgroundColor: 'var(--cp-orange)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => cerrarCheckout()}
                      style={{ border: 0, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    >
                      Seguir agregando productos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalidad('RECOGER');
                        setErrorPaso(null);
                        setErrorEnvio(null);
                      }}
                      style={{ border: 0, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    >
                      Cambiar a Recoger
                    </button>
                  </div>
                </div>
              )}

              {/* Mensaje de error del apartado o de la API */}
              {(errorPaso || errorEnvio) && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: '#FDECEA',
                    color: 'var(--cp-rust)',
                    border: '1.5px solid var(--cp-rust)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: '17px',
                  }}
                >
                  {errorPaso || errorEnvio}
                </div>
              )}

              {/* Botones de navegación según el paso */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {paso > 1 && (
                  <button
                    type="button"
                    onClick={retrocederPaso}
                    style={{
                      flex: '0 0 100px',
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      backgroundColor: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Atrás
                  </button>
                )}

                {paso < 3 ? (
                  <button
                    type="button"
                    onClick={avanzarPaso}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: 'var(--cp-navy)',
                      color: 'var(--cp-white)',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: 'pointer',
                    }}
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => void enviarPedido()}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: 0,
                      backgroundColor: enviando ? 'var(--cp-line)' : 'var(--cp-orange)',
                      color: enviando ? 'var(--cp-soft)' : '#FFFFFF',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: enviando ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {enviando ? 'Enviando pedido...' : `Enviar pedido · S/ ${totalCalculado.toFixed(2)}`}
                  </button>
                )}
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    cerrarCheckout();
                    abrirCajon();
                  }}
                  style={{
                    border: 0,
                    backgroundColor: 'transparent',
                    color: 'var(--cp-soft)',
                    fontSize: '12px',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  Volver a mi pedido
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ================= MODAL MAPA A PANTALLA COMPLETA ================= */}
      {mapaCompletoAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Marca dónde recibes tu pedido"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            backgroundColor: 'var(--cp-white)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Barra superior */}
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderBottom: '1px solid var(--cp-line)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(11,44,62,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                  margin: 0,
                }}
              >
                Marca dónde recibes tu pedido
              </h3>
              <button
                type="button"
                onClick={() => setMapaCompletoAbierto(false)}
                aria-label="Cerrar mapa"
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1.5px solid var(--cp-navy)',
                  backgroundColor: 'transparent',
                  color: 'var(--cp-navy)',
                  fontSize: '22px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <BuscadorDireccion
              onElegir={(p, texto) => {
                if (!direccion.trim()) {
                  setDireccion(texto.split(',').slice(0, 2).join(',').trim());
                }
                void fijarPunto(p.lat, p.lng, 'MAPA');
              }}
            />
          </div>

          {/* Espacio del mapa a pantalla completa */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <MapaUbicacion
              punto={coordenadas}
              local={tiendaCoords}
              onCambiar={(p) => void fijarPunto(p.lat, p.lng, 'MAPA')}
              altura="100%"
              ajustarA="ambos"
              etiqueta="Mapa de pantalla completa para marcar la entrega"
              style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none' }}
            />
          </div>

          {/* Barra inferior */}
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderTop: '1px solid var(--cp-line)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              zIndex: 10,
              boxShadow: '0 -2px 8px rgba(11,44,62,0.06)',
            }}
          >
            {resumenEnvio && (
              <div role="status" style={{ fontSize: '13px', lineHeight: '18px', fontWeight: 600, color: 'var(--cp-green)' }}>
                {resumenEnvio}
              </div>
            )}
            {mensajeGps ? (
              <div
                role="status"
                style={{
                  fontSize: '13px',
                  lineHeight: '18px',
                  fontWeight: 600,
                  color: mensajeGps.includes('FUERA_DE_COBERTURA')
                    ? 'var(--cp-rust)'
                    : 'var(--cp-green)',
                }}
              >
                {mensajeGps}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                Toca o arrastra en el mapa para marcar dónde recibirás tu pedido.
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setUbicacionConfirmada(true);
                setMapaCompletoAbierto(false);
              }}
              disabled={
                !coordenadas ||
                (costoEnvio === null && Boolean(mensajeGps?.includes('FUERA_DE_COBERTURA')))
              }
              style={{
                width: '100%',
                minHeight: '48px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor:
                  !coordenadas || (costoEnvio === null && Boolean(mensajeGps?.includes('FUERA_DE_COBERTURA')))
                    ? 'var(--cp-line)'
                    : 'var(--cp-orange)',
                color:
                  !coordenadas || (costoEnvio === null && Boolean(mensajeGps?.includes('FUERA_DE_COBERTURA')))
                    ? 'var(--cp-soft)'
                    : '#FFFFFF',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '15px',
                cursor:
                  !coordenadas || (costoEnvio === null && Boolean(mensajeGps?.includes('FUERA_DE_COBERTURA')))
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              Confirmar ubicación
            </button>
          </div>
        </div>
      )}
    </>
  );
}
