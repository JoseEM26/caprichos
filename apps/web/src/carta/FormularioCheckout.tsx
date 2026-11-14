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
import { envioGratisPromoAplica, type PromoEnvioGratisCarta } from '../comun/envioGratis';
import { MapaUbicacion } from '../comun/mapa/MapaUbicacion';
import { SEDE_DEFECTO } from '../comun/mapa/sedeDefecto';
import { BuscadorDireccion } from '../comun/mapa/BuscadorDireccion';
import { enlaceGoogleMaps } from '../comun/mapa/leaflet';
import { useCarrito } from './CarritoContext';
import { PuntosCanje, estimarPuntos } from './cuenta/PuntosCanje';
type DatosRuc = { ruc: string; razon_social: string; estado: string | null; condicion: string | null; direccion: string | null; desactualizado: boolean };
type ConsultaRuc =
  | { estado: 'idle' | 'cargando' | 'invalido' | 'noencontrado' | 'manual' }
  | { estado: 'ok'; datos: DatosRuc };
import { useCuentaOpcional } from './cuenta/CuentaContext';
import { SelectorPagoEquipo, type PagoEquipo } from './SelectorPagoEquipo';
import { guardarPedido } from './seguimiento';
import { mensajeExceso, excesosDeStock, lineasSaborIncompletas, mensajeSaborQuedan, saborRechazadoDe, stockInsuficienteDe, textoSabores } from './stock';
import { AjusteSaboresLinea } from './AjusteSaboresLinea';
import { SelectorDireccionesCliente } from './SelectorDireccionesCliente';
import { useEsMovil } from './useEsMovil';
import { armarPlanCarta, medioPrincipalCarta } from './pagoDividido';
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

import { AvisoComerEnLocal } from './AvisoComerEnLocal';
import { aplicaModalidad, NOMBRE_MODALIDAD } from './modalidadOferta';
import { cabeceraSesionCarta, useEventoCarta } from './eventosCarta';

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
    inventario,
    marcarQuedan,
    marcarQuedanSabor,
    ajustarCantidadProducto,
    lineaAjustandoId,
    abrirAjusteLinea,
  } = useCarrito();

  // Productos que superan lo que queda (el saldo cambió) y el 409 del último envío.
  // Las mezclas sin sabores completos también frenan el envío.
  const excesos = excesosDeStock(lineas, inventario);
  const pendientesSabor = lineasSaborIncompletas(lineas);
  const enviarBloqueadoPorStock = excesos.length > 0 || pendientesSabor.length > 0;
  // La carta se actualiza sola: si cierra (o entra en pausa) con el checkout abierto, se avisa y no se deja enviar
  const localCerrado = Boolean(estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda));
  const [stockRechazado, setStockRechazado] = useState<{ productoId: string | null; quedan: number; mensaje: string; saborId?: string } | null>(null);
  useEffect(() => {
    if (!checkoutAbierto) setStockRechazado(null);
  }, [checkoutAbierto]);

  // Control de apartados (pasos 1, 2, 3)
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const { emitir: emitirEvento } = useEventoCarta();
  useEffect(() => {
    if (checkoutAbierto) emitirEvento('CHECKOUT');
  }, [checkoutAbierto, emitirEvento]);
  useEffect(() => {
    if (checkoutAbierto && paso === 3) emitirEvento('PAGO');
  }, [checkoutAbierto, paso, emitirEvento]);
  const [pasoMaximo, setPasoMaximo] = useState<1 | 2 | 3>(1);
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  // En celular el pie (total y botones) queda fijo abajo y solo se desplaza el contenido
  const movil = useEsMovil();

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
  const [promoEnvio, setPromoEnvio] = useState<PromoEnvioGratisCarta | null>(null);
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

  // Comprobante: simple (por defecto, sin datos ni SUNAT), boleta o factura
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('SIMPLE');
  const [dni, setDni] = useState('');
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  // Consulta del RUC a SUNAT (vía servidor): la razón social sale de ahí; solo si no está disponible se escribe a mano (sin verificar)
  const [consultaRuc, setConsultaRuc] = useState<ConsultaRuc>({ estado: 'idle' });

  useEffect(() => {
    if (tipoComprobante !== 'FACTURA' || !/^(10|15|17|20)\d{9}$/.test(ruc)) {
      setConsultaRuc({ estado: 'idle' });
      return;
    }
    let vigente = true;
    setConsultaRuc({ estado: 'cargando' });
    api
      .get<DatosRuc>(`/carta/ruc/${ruc}`)
      .then((d) => {
        if (!vigente) return;
        setRazonSocial(d.razon_social);
        setConsultaRuc({ estado: 'ok', datos: d });
      })
      .catch((e) => {
        if (!vigente) return;
        const codigo = e instanceof ErrorApi ? e.codigo : '';
        if (codigo === 'RUC_NO_ENCONTRADO') setConsultaRuc({ estado: 'noencontrado' });
        else if (codigo === 'RUC_INVALIDO') setConsultaRuc({ estado: 'invalido' });
        else setConsultaRuc({ estado: 'manual' });
      });
    return () => {
      vigente = false;
    };
  }, [ruc, tipoComprobante]);

  // Medio de pago
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('YAPE');
  const [pagaCon, setPagaCon] = useState('');
  // Pago dividido: dos medios; el primero lleva el monto y el segundo, el resto
  const [dividirPago, setDividirPago] = useState(false);
  const [monto1Texto, setMonto1Texto] = useState('');
  const [medio2, setMedio2] = useState<MetodoPago | null>(null);
  // Propina opcional (solo si Configuración la enciende para la carta). Va aparte de la venta.
  const [propinaTexto, setPropinaTexto] = useState('');
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
    envioGratis?: boolean;
  } | null>(null);
  const [cargandoCupon, setCargandoCupon] = useState(false);
  const [puntosAplicados, setPuntosAplicados] = useState(0);
  const [promos, setPromos] = useState<{ total: number; canjeable: number | null; puntosEstimados: number | null; porcentaje: number | null; detalles: { tipo?: string; nombre: string; monto: number }[] }>({ total: 0, canjeable: null, puntosEstimados: null, porcentaje: null, detalles: [] });
  const cuentaCtx = useCuentaOpcional();
  const clienteCuenta = cuentaCtx?.cliente ?? null;
  // Solo el equipo con sesión ve la elección contado / crédito del personal (el servidor vuelve a decidirlo)
  const equipoCuenta = clienteCuenta ? (cuentaCtx?.equipo ?? null) : null;
  const [pagoEquipo, setPagoEquipo] = useState<PagoEquipo>('CONTADO');
  // Crédito: cubre los productos. Con delivery el envío NUNCA va a crédito: se paga ahora, al contado
  const conCredito = !!equipoCuenta?.puedeCredito && pagoEquipo === 'CREDITO';
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
  // RUC guardado en la cuenta: solo con sesión iniciada (el servidor no lo da por un celular tecleado). Se rellena una vez.
  const [rucGuardado, setRucGuardado] = useState<string | null>(null);
  const rucPrecargado = useRef(false);
  useEffect(() => {
    if (tipoComprobante !== 'FACTURA' || !clienteCuenta || rucPrecargado.current) return;
    rucPrecargado.current = true;
    api
      .get<{ facturacion: { ruc: string } | null }>('/carta/cuenta/facturacion')
      .then((r) => {
        if (!r.facturacion?.ruc) return;
        setRucGuardado(r.facturacion.ruc);
        setRuc((actual) => actual || r.facturacion!.ruc);
      })
      .catch(() => {});
  }, [tipoComprobante, clienteCuenta]);

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
  const detalleEquipo = promos.detalles.find((d) => d.tipo === 'PERSONAL');
  const pctEquipo = detalleEquipo?.nombre.match(/\((\d+(?:[.,]\d+)?) %\)/)?.[1];
  const clavePromos = JSON.stringify([lineas.map((l) => [l.productoId, l.cantidad, l.subtotal]), cuponAplicado?.codigo, tieneSesion, modalidad]);
  useEffect(() => {
    if (!checkoutAbierto || lineas.length === 0) return;
    let vigente = true;
    api
      .post<{ descuentoTotal: number; montoCanjeable?: number; puntosEstimados?: number; puntosPorcentaje?: number; detalles: { tipo?: string; nombre: string; monto: number }[] }>('/carta/descuentos/vista-previa', {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, subtotal: l.subtotal, precioUnitario: l.precioUnitario })),
        cuponCodigo: cuponAplicado?.codigo,
        // Las promociones valen según el tipo de pedido: al cambiarlo se recalcula sin perder el carrito
        modalidad,
      })
      .then((r) => vigente && setPromos({ total: Number(r?.descuentoTotal) || 0, canjeable: typeof r?.montoCanjeable === 'number' ? r.montoCanjeable : null, puntosEstimados: typeof r?.puntosEstimados === 'number' ? r.puntosEstimados : null, porcentaje: typeof r?.puntosPorcentaje === 'number' ? r.puntosPorcentaje : null, detalles: Array.isArray(r?.detalles) ? r.detalles : [] }))
      .catch(() => vigente && setPromos({ total: 0, canjeable: null, puntosEstimados: null, porcentaje: null, detalles: [] }));
    return () => {
      vigente = false;
    };
  }, [checkoutAbierto, clavePromos]);

  // Combos del carrito que no valen para la modalidad elegida (se avisa; el servidor también los rechaza)
  const [ofertasCarta, setOfertasCarta] = useState<OfertaItem[]>([]);
  useEffect(() => {
    if (!checkoutAbierto || !lineas.some((l) => l.ofertaId)) return;
    let vigente = true;
    api
      .get<OfertaItem[]>('/carta/ofertas')
      .then((r) => vigente && setOfertasCarta(Array.isArray(r) ? r : []))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [checkoutAbierto, lineas.length]);
  const ofertasNoAplican = lineas
    .filter((l) => l.ofertaId)
    .map((l) => ofertasCarta.find((o) => String(o.id) === String(l.ofertaId)))
    .filter((o): o is OfertaItem => !!o && !aplicaModalidad(o.modalidades, modalidad))
    .filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i);
  const sinModalidadOferta = ofertasNoAplican.length > 0;

  // Sin sesión: se avisa que la primera compra se aplica al iniciar sesión (la validación real es del servidor)
  useEffect(() => {
    if (!checkoutAbierto || tieneSesion) return;
    let vigente = true;
    api
      .get<OfertaItem[]>('/carta/ofertas')
      .then((r) => {
        const oferta = (Array.isArray(r) ? r : []).find((o) => o.activo !== false && o.soloPrimeraCompra && o.vigenteAhora);
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
  // Paso 2 en delivery sin ubicación elegida: Continuar queda deshabilitado con el aviso junto al botón
  const faltaElegirDireccion = paso === 2 && modalidad === 'DELIVERY' && pideEleccionDireccion;

  // Cálculo del total
  // Envío gratis: por cupón de envío (aplicado) o por la promo ENVIO_GRATIS vigente. El servidor decide al crear el pedido.
  const envioGratisCupon = cuponAplicado?.envioGratis === true;
  const envioGratisPromo = !envioGratisCupon && !!zonaEnvio && envioGratisPromoAplica(promoEnvio, subtotal);
  const envioGratisActivo = envioGratisCupon || envioGratisPromo;
  const costoEnvioEfectivo = modalidad === 'DELIVERY' ? (envioGratisActivo ? 0 : costoEnvio) : 0;
  const resumenEnvio =
    modalidad === 'DELIVERY' && zonaEnvio && tarifaZona !== null
      ? envioGratisActivo
        ? `Zona ${zonaEnvio} · envío gratis`
        : textoResumenEnvio(zonaEnvio, tarifaZona, subtotal, reglaEnvio)
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
          envioGratis: res.cupon.envioGratis === true,
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
        setPromoEnvio(res.envioGratisPromo ?? null);
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
  const propinaActiva = datosLocal?.propina?.carta === true;
  const topePropina = datosLocal?.propina?.tope && datosLocal.propina.tope > 0 ? datosLocal.propina.tope : 200;
  const propinaLimpia = propinaTexto.trim().replace(',', '.');
  const propinaFormatoOk = propinaLimpia === '' || /^\d+(\.\d{1,2})?$/.test(propinaLimpia);
  const propinaNum = propinaActiva && propinaFormatoOk && propinaLimpia !== '' ? Number(propinaLimpia) : 0;
  const propinaCobrable = propinaActiva && propinaFormatoOk && propinaNum > 0 && propinaNum <= topePropina ? Math.round(propinaNum * 100) / 100 : 0;
  const propinaInvalida = propinaActiva && propinaLimpia !== '' && (!propinaFormatoOk || propinaNum > topePropina);
  // Lo que paga el cliente: venta + propina (el comprobante y los puntos usan solo la venta)
  // Crédito + delivery: los productos van a crédito y se paga ahora solo el envío (si ya se conoce y no es gratis)
  const creditoConDelivery = conCredito && modalidad === 'DELIVERY';
  const envioConocido = !!zonaEnvio || envioGratisActivo;
  const envioAhora = creditoConDelivery && envioConocido ? Math.min(costoEnvioEfectivo ?? 0, totalCalculado) : 0;
  // Con envío gratis no hay nada que pagar; sin ubicación aún, el envío se confirma y se paga después con el medio elegido
  const pagaEnvio = creditoConDelivery && (!envioConocido || envioAhora > 0);
  const productosACredito = creditoConDelivery ? Number((totalCalculado - envioAhora).toFixed(2)) : totalCalculado;
  const aCobrar = creditoConDelivery ? envioAhora : Number((totalCalculado + (conCredito ? 0 : propinaCobrable)).toFixed(2));
  // Pago dividido: plan válido (o null) y parte en efectivo (lo que cubre «Paga con»)
  const planDividido = dividirPago
    ? armarPlanCarta(metodoPago, monto1Texto, medio2, aCobrar)
    : ({ plan: null, error: null } as const);
  const efectivoParte = planDividido.plan
    ? (planDividido.plan.find((f) => f.medio === 'EFECTIVO')?.monto ?? 0)
    : dividirPago
      ? 0
      : metodoPago === 'EFECTIVO'
        ? aCobrar
        : 0;
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
    // Nombre (2+ letras) y celular real son obligatorios siempre, con o sin cuenta
    if (nombre.trim().length < 2) {
      return 'Escribe tu nombre (mínimo 2 letras)';
    }
    const telLimpio = telefono.trim();
    // El celular solo es obligatorio en delivery; si se escribe, debe ser real
    if (!telLimpio && modalidad === 'DELIVERY') return 'Escribe tu celular: 9 dígitos que empiecen con 9';
    if (telLimpio && (!/^9\d{8}$/.test(telLimpio) || telLimpio === '999999999')) {
      return 'El teléfono debe tener 9 dígitos, empezar con 9 y ser un número real';
    }
    return null;
  };

  const validarPaso2 = (): string | null => {
    if (modalidad === 'DELIVERY') {
      if (faltanteMinimo > 0) return mensajeMinimo;
      if (usarUltimaDireccion) return null;
      if (pideEleccionDireccion) {
        return 'Elige a dónde lo enviamos: una de tus direcciones anteriores o una nueva';
      }
      if (coordenadas) {
        if (!ubicacionConfirmada) {
          return 'Confirma con «Mi pedido llega aquí» que el punto rojo es donde recibirás tu pedido';
        }
      } else {
        // Sin ubicación: dirección y referencia escritas; el envío se confirma por WhatsApp
        if (direccion.trim().length < 5) return 'Para delivery debes indicar una dirección de al menos 5 caracteres o usar tu ubicación';
        if (referencia.trim().length < 3) return 'Para delivery escribe una referencia (por ejemplo: frente al parque, portón blanco)';
      }
    }
    return null;
  };

  const validarPaso3 = (): string | null => {
    if (conCredito && !pagaEnvio) return null; // a crédito no hay comprobante, medio de pago ni propina (salvo el medio del envío)
    if (conCredito) {
      // solo el medio del envío: sin comprobante ni propina
    } else if (tipoComprobante === 'FACTURA') {
      const rucLimpio = ruc.trim();
      if (!/^(10|15|17|20)\d{9}$/.test(rucLimpio)) {
        return 'Para factura se exige un RUC válido de 11 dígitos que empiece con 10, 15, 17 o 20 (un RUC de 10 dígitos no se acepta)';
      }
      if (consultaRuc.estado === 'cargando') return 'Espera un momento: estamos consultando el RUC en SUNAT';
      if (consultaRuc.estado === 'invalido') return 'El RUC no es válido: revisa los números';
      if (consultaRuc.estado === 'noencontrado') return 'SUNAT no reconoce este RUC: revísalo para pedir factura';
      if (!razonSocial.trim()) {
        return 'Para factura se exige la razón social';
      }
    } else if (tipoComprobante === 'BOLETA') {
      const dniLimpio = dni.trim();
      if (dniLimpio && !/^\d{8}$/.test(dniLimpio)) {
        return 'El DNI debe tener 8 dígitos numéricos';
      }
    }

    if (propinaInvalida && !conCredito) {
      return `La propina debe ser un monto entre S/ 0 y S/ ${topePropina.toFixed(2)}, con hasta 2 decimales`;
    }

    if (dividirPago && planDividido.error) return planDividido.error;

    if (efectivoParte > 0) {
      if (!pagaCon.trim()) return 'Escribe con cuánto pagas en efectivo (si pagas justo, toca «Pago exacto»)';
      const pagaConNum = Number(pagaCon);
      if (isNaN(pagaConNum) || pagaConNum < efectivoParte) {
        return `El monto con el que pagas (S/ ${pagaCon}) no puede ser menor a lo que pagas en efectivo (S/ ${efectivoParte.toFixed(2)})`;
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

  // Deja cada producto con lo que queda (o lo quita si no queda nada); los datos del cliente no se tocan
  // Con sabores, el ajuste es reelegir los sabores de la línea (ventana de ajuste); el resto del pedido no se toca
  const ajustarPedidoAStock = () => {
    const conSabor = excesos.find((e) => e.saborId) ?? (stockRechazado?.saborId ? { productoId: stockRechazado.productoId } : undefined);
    const linea = conSabor
      ? lineas.find((l) => String(l.productoId) === String(conSabor.productoId) && (l.sabores ?? []).length > 0)
      : pendientesSabor[0];
    if (conSabor || pendientesSabor.length > 0) {
      if (linea) abrirAjusteLinea(linea.id);
      setStockRechazado(null);
      setErrorEnvio(null);
      return;
    }
    for (const e of excesos) ajustarCantidadProducto(e.productoId, e.quedan);
    if (stockRechazado?.productoId) ajustarCantidadProducto(stockRechazado.productoId, stockRechazado.quedan);
    setStockRechazado(null);
    setErrorEnvio(null);
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

    if (sinModalidadOferta) {
      setErrorEnvio(`${ofertasNoAplican[0].nombre} no aplica para ${NOMBRE_MODALIDAD[modalidad]}. Cambia el tipo de pedido o quítala del carrito.`);
      return;
    }

    if (enviarBloqueadoPorStock) {
      setErrorEnvio(
        excesos.length > 0
          ? 'Hay productos por encima de lo que queda. Ajusta tu pedido antes de enviar.'
          : `Elige los sabores de ${pendientesSabor[0].nombre} antes de enviar.`,
      );
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
          ...(lin.sabores ? { sabores: lin.sabores.map((x) => ({ saborId: x.saborId, cantidad: x.cantidad })) } : {}),
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
      ...(equipoCuenta ? { pagoEquipo: conCredito ? 'CREDITO' : 'CONTADO' } : {}),
      pago: conCredito && !pagaEnvio
        ? { metodo: 'EFECTIVO' as const }
        : {
        metodo: planDividido.plan ? medioPrincipalCarta(planDividido.plan) : metodoPago,
        pagaCon: efectivoParte > 0 && pagaCon.trim() ? Number(pagaCon) : undefined,
        ...(planDividido.plan ? { plan: planDividido.plan } : {}),
      },
      comprobante: conCredito ? { tipo: 'SIMPLE' as const } : {
        tipo: tipoComprobante,
        dni: tipoComprobante === 'BOLETA' && dni.trim() ? dni.trim() : undefined,
        ruc: tipoComprobante === 'FACTURA' ? ruc.trim() : undefined,
        razonSocial: tipoComprobante === 'FACTURA' ? razonSocial.trim() : undefined,
        ...(tipoComprobante === 'FACTURA' && consultaRuc.estado === 'ok' && consultaRuc.datos.direccion ? { direccion: consultaRuc.datos.direccion } : {}),
      },
      cuponCodigo: cuponAplicado ? cuponAplicado.codigo : undefined,
      puntosCanje: !cuponAplicado && puntosAplicados > 0 ? puntosAplicados : undefined,
      propina: !conCredito && propinaCobrable > 0 ? propinaCobrable : undefined,
    };

    try {
      const respuesta = await api.post<any>('/pedidos', payload, {
        headers: {
          'Idempotency-Key': claveIdempotenciaRef.current,
          ...cabeceraSesionCarta(),
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
        propina: respuesta.propina,
        mensaje: respuesta.mensaje,
        clienteNombre: nombre.trim(),
        modalidad,
        seguimientoToken: respuesta.seguimientoToken,
      });
    } catch (err) {
      if (err instanceof ErrorApi) {
        const sabor = saborRechazadoDe(err);
        const stock = stockInsuficienteDe(err);
        if (sabor) {
          // el sabor pasa a su nuevo saldo: la línea queda marcada y el ajuste reabre sus sabores
          marcarQuedanSabor(sabor.productoId, sabor.saborId, sabor.quedan);
          setStockRechazado({ productoId: sabor.productoId, quedan: sabor.quedan, mensaje: mensajeSaborQuedan(sabor.quedan, sabor.saborNombre), saborId: sabor.saborId });
          setErrorEnvio(null);
        } else if (stock) {
          setStockRechazado(stock);
          if (stock.productoId) marcarQuedan(stock.productoId, stock.quedan);
          setErrorEnvio(null);
        } else if (err.codigo === 'PRODUCTO_AGOTADO') {
          setErrorEnvio(err.message || 'Uno de los productos seleccionados se encuentra agotado.');
        } else if (err.codigo === 'COMBO_PARTE_NO_DISPONIBLE') {
          setErrorEnvio(`${err.message} Tu carrito sigue igual: quita el combo y vuelve a agregarlo para elegir otro reemplazo.`);
        } else if (err.codigo === 'CARTA_CERRADA') {
          setErrorEnvio(`${err.message || 'La carta se encuentra cerrada'}. No es posible enviar pedidos ahora.`);
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
      {lineaAjustandoId && <AjusteSaboresLinea />}
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
          padding: movil ? 0 : '16px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: movil ? '100%' : 'min(580px, 100%)',
            maxHeight: movil ? undefined : '92vh',
            height: movil ? '100%' : undefined,
            backgroundColor: 'var(--cp-cream)',
            borderRadius: movil ? 0 : '20px',
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
                minHeight: 0,
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
                    <button
                      type="button"
                      data-testid="modalidad-comer-local"
                      onClick={() => setModalidad('COMER_LOCAL')}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: modalidad === 'COMER_LOCAL' ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)',
                        backgroundColor: modalidad === 'COMER_LOCAL' ? 'var(--cp-sand)' : 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        fontWeight: 800,
                        fontSize: '14px',
                      }}
                    >
                      <span aria-hidden="true">🍽️ </span>Comer en el local
                    </button>
                    {modalidad === 'COMER_LOCAL' && <AvisoComerEnLocal nombre={nombre} />}
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
                            ? 'Sigues como invitado: necesitamos tu nombre y tu celular.'
                            : 'Tus puntos se suman con tu celular, sin contraseña. Solo necesitamos tu nombre (y tu celular si quieres sumar puntos). ¿Quieres verlos?'}{' '}
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
                          Teléfono celular (9 dígitos){modalidad === 'DELIVERY' ? '' : ' · opcional'}
                        </label>
                        <input
                          id="f-tel"
                          type="tel"
                          inputMode="numeric"
                          maxLength={9}
                          value={telefono}
                          onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ej.: 987654321"
                          required={modalidad === 'DELIVERY'}
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
                          {modalidad === 'DELIVERY'
                            ? 'Tu celular es obligatorio: sumas puntos con tu número, sin contraseña.'
                            : telefono.trim()
                              ? 'Sumas puntos con tu número, sin contraseña.'
                              : 'Sin celular no se suman puntos.'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                          Te enviaremos una breve encuesta de satisfacción por WhatsApp
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
                        alUbicacionActual={() => {
                          elegirDireccionNueva();
                          obtenerUbicacionGps();
                        }}
                        cargandoUbicacion={cargandoGps}
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
                          {coordenadas ? 'Referencia (opcional)' : 'Referencia (obligatoria si no marcas ubicación)'}
                        </label>
                        <input
                          id="f-referencia"
                          type="text"
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="Frente al parque, portón blanco..."
                          required={!coordenadas}
                          aria-required={!coordenadas}
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
                            data-testid="aviso-envio-por-confirmar"
                            style={{
                              fontSize: '11px',
                              color: 'var(--cp-soft)',
                              fontStyle: 'italic',
                            }}
                          >
                            Envío por confirmar: si no marcas tu ubicación, escribe dirección y referencia; después de pedir te escribimos por WhatsApp para que nos envíes tu ubicación con un toque.
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                    </>
                  ) : modalidad === 'COMER_LOCAL' ? (
                    /* Comer en el local: sin mesa, sin croquis, sin dirección; se le llama por su nombre */
                    <AvisoComerEnLocal nombre={nombre} />
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
                  {equipoCuenta && (
                    <SelectorPagoEquipo valor={pagoEquipo} alCambiar={setPagoEquipo} puedeCredito={equipoCuenta.puedeCredito} esDelivery={modalidad === 'DELIVERY'} />
                  )}
                  {conCredito && (
                    <div
                      data-testid="resumen-credito-equipo"
                      style={{ backgroundColor: 'var(--cp-white)', padding: '14px', borderRadius: '14px', border: '1px solid var(--cp-line)', fontSize: '13px', lineHeight: '18px' }}
                    >
                      {creditoConDelivery ? (
                        <>
                          <div>
                            A tu crédito del personal: <strong>S/ {productosACredito.toFixed(2)}</strong> (se descuenta a fin de mes)
                          </div>
                          <div>
                            {!envioConocido
                              ? 'El envío lo pagas ahora, al contado: te confirmamos su costo por WhatsApp.'
                              : envioAhora > 0
                                ? <>Pagas ahora el envío: <strong>S/ {envioAhora.toFixed(2)}</strong></>
                                : 'Tu envío es gratis: no pagas nada ahora.'}
                          </div>
                        </>
                      ) : (
                        <div>
                          Se carga a tu crédito: <strong>S/ {totalCalculado.toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                  {(!conCredito || pagaEnvio) && (
                  <>
                  {!conCredito && (
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
                      {(
                        [
                          ['SIMPLE', 'Comprobante simple'],
                          ['BOLETA', 'Boleta'],
                          ['FACTURA', 'Factura'],
                        ] as const
                      ).map(([tipo, etiqueta]) => (
                        <button
                          key={tipo}
                          type="button"
                          aria-pressed={tipoComprobante === tipo}
                          onClick={() => setTipoComprobante(tipo)}
                          style={{
                            flex: 1,
                            minHeight: '44px',
                            borderRadius: '10px',
                            border:
                              tipoComprobante === tipo
                                ? '2px solid var(--cp-orange)'
                                : '1.5px solid var(--cp-line)',
                            backgroundColor:
                              tipoComprobante === tipo ? 'var(--cp-sand)' : 'var(--cp-white)',
                            color: 'var(--cp-navy)',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>

                    {tipoComprobante === 'SIMPLE' ? (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        Es el ticket de tu pedido, sin datos tuyos. Si necesitas boleta o factura con SUNAT, elígela aquí.
                      </div>
                    ) : null}

                    {tipoComprobante === 'SIMPLE' ? null : tipoComprobante === 'BOLETA' ? (
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
                          {rucGuardado && ruc === rucGuardado && (
                            <div role="status" style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '3px' }}>
                              RUC guardado en tu cuenta. Puedes escribir otro para este pedido.
                            </div>
                          )}
                        </div>

                        {consultaRuc.estado === 'cargando' && (
                          <div role="status" style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Consultando SUNAT…</div>
                        )}
                        {consultaRuc.estado === 'invalido' && (
                          <div role="alert" style={{ fontSize: '12px', color: 'var(--cp-error, #b3261e)' }}>El RUC no es válido: revisa los números.</div>
                        )}
                        {consultaRuc.estado === 'noencontrado' && (
                          <div role="alert" style={{ fontSize: '12px', color: 'var(--cp-error, #b3261e)' }}>SUNAT no reconoce este RUC: revísalo.</div>
                        )}
                        {consultaRuc.estado === 'ok' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Razón social</div>
                            <div data-testid="razon-verificada" style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>{consultaRuc.datos.razon_social}</div>
                            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                              Verificado en SUNAT{consultaRuc.datos.desactualizado ? ' (dato guardado, puede estar desactualizado)' : ''}
                            </div>
                            {consultaRuc.datos.direccion && (
                              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Dirección fiscal: {consultaRuc.datos.direccion}</div>
                            )}
                            {(consultaRuc.datos.estado !== 'ACTIVO' || consultaRuc.datos.condicion !== 'HABIDO') && (
                              <div role="alert" style={{ fontSize: '12px', color: 'var(--cp-error, #b3261e)' }}>
                                SUNAT indica que este RUC está {[consultaRuc.datos.estado, consultaRuc.datos.condicion].filter(Boolean).join(' / ') || 'sin datos de estado'}: la factura podría no ser válida.
                              </div>
                            )}
                          </div>
                        )}
                        {consultaRuc.estado === 'manual' && (
                          <div>
                            <label
                              htmlFor="f-rs"
                              style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', display: 'block', marginBottom: '4px' }}
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
                            <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '3px' }}>
                              Sin verificar: no pudimos consultar SUNAT; Caja revisará el dato.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  </>
                  )}

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

                    {/* Pago dividido: dos medios (p. ej. Yape S/ 38 y el resto en efectivo al recibir) */}
                    <button
                      type="button"
                      data-testid="alternar-pago-dividido"
                      aria-pressed={dividirPago}
                      onClick={() => {
                        setDividirPago((v) => !v);
                        setMedio2(null);
                        setMonto1Texto('');
                      }}
                      style={{ minHeight: '44px', borderRadius: '10px', border: '1.5px dashed var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      {dividirPago ? 'Pagar con un solo medio' : 'Pagar con 2 medios'}
                    </button>

                    {dividirPago && (
                      <div data-testid="pago-dividido" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="f-monto1" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                          ¿Cuánto pagas con {metodoPago}? (S/)
                        </label>
                        <input
                          id="f-monto1"
                          type="number"
                          step="0.10"
                          min="0.01"
                          value={monto1Texto}
                          onChange={(e) => setMonto1Texto(e.target.value)}
                          placeholder={`Menor a ${aCobrar.toFixed(2)}`}
                          style={{ width: '100%', minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', backgroundColor: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 12px', fontSize: '14px' }}
                        />
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>El resto lo pagas con</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as MetodoPago[])
                            .filter((m) => m !== metodoPago)
                            .filter((m) => m === 'EFECTIVO' || m === 'TARJETA' || mediosPagoDisponibles[m.toLowerCase()]?.activo !== false)
                            .map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setMedio2(m)}
                                aria-pressed={medio2 === m}
                                style={{ minHeight: '44px', padding: '0 14px', borderRadius: '10px', border: medio2 === m ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)', backgroundColor: medio2 === m ? 'var(--cp-sand)' : 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px' }}
                              >
                                {m}
                              </button>
                            ))}
                        </div>
                        <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: planDividido.error ? 'var(--cp-rust)' : 'var(--cp-navy)' }}>
                          {planDividido.plan
                            ? planDividido.plan.map((f) => `${f.medio} S/ ${f.monto.toFixed(2)}`).join(' + ')
                            : planDividido.error}
                        </div>
                      </div>
                    )}

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

                    {propinaActiva && !conCredito && (
                      <div data-testid="propina-carta">
                        <label htmlFor="f-propina" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)', display: 'block', marginBottom: '4px' }}>
                          Propina opcional para el equipo (S/)
                        </label>
                        <input
                          id="f-propina"
                          type="text"
                          inputMode="decimal"
                          value={propinaTexto}
                          onChange={(e) => setPropinaTexto(e.target.value)}
                          placeholder="0.00"
                          style={{ width: '100%', minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-line)', backgroundColor: 'var(--cp-cream)', color: 'var(--cp-navy)', padding: '0 12px', fontSize: '16px' }}
                        />
                        <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px', marginTop: '4px' }}>
                          Va aparte de tu pedido: no es parte del total de productos ni del comprobante. Máximo S/ {topePropina.toFixed(2)}. Déjalo vacío si no quieres dejar propina.
                        </div>
                      </div>
                    )}

                    {metodoPago === 'TARJETA' && (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                        Pagas con tarjeta de débito o crédito cuando recibes o recoges tu pedido (pos inalámbrico).
                      </div>
                    )}

                    {efectivoParte > 0 && (
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
                          Paga con (monto en soles, obligatorio){planDividido.plan ? ` · efectivo S/ ${efectivoParte.toFixed(2)}` : ''}
                        </label>
                        <input
                          id="f-paga-con"
                          type="number"
                          step="0.10"
                          min={efectivoParte}
                          value={pagaCon}
                          onChange={(e) => setPagaCon(e.target.value)}
                          aria-required="true"
                          placeholder={`Ej.: ${Math.ceil(efectivoParte / 10) * 10}`}
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
                        <button
                          type="button"
                          onClick={() => setPagaCon(efectivoParte.toFixed(2))}
                          style={{
                            marginTop: '6px',
                            minHeight: '36px',
                            borderRadius: '10px',
                            border: '1.5px solid var(--cp-line)',
                            background: 'var(--cp-white)',
                            color: 'var(--cp-navy)',
                            fontWeight: 700,
                            fontSize: '13px',
                            padding: '0 12px',
                            cursor: 'pointer',
                          }}
                        >
                          Pago exacto (S/ {efectivoParte.toFixed(2)})
                        </button>
                      </div>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '16px' }}>
                      Tu pedido pasa directo a cocina. Un asesor te contactará por WhatsApp para coordinar el pago.
                    </div>
                  </div>

                  </>
                  )}

                  {/* Campo de cupón / puntos */}
                  {!cuponAplicado && clienteCuenta && !conCredito && (
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
                      {cuponAplicado?.envioGratis && modalidad !== 'DELIVERY' && (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-rust)' }}>
                          El cupón de envío gratis solo aplica a delivery.
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
                    {lineas.some((l) => l.sabores?.length) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--cp-navy)' }}>
                        {lineas
                          .filter((l) => l.sabores?.length)
                          .map((l) => (
                            <span key={l.id} style={{ overflowWrap: 'anywhere' }}>
                              <b>{`${l.cantidad} × ${l.nombre}`}</b>{`: ${textoSabores(l)}`}
                            </span>
                          ))}
                      </div>
                    )}
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

                    {clienteCuenta && detalleEquipo && (
                          <div role="status" style={{ fontSize: '13px', color: 'var(--cp-navy)', background: 'var(--cp-sand)', borderRadius: '8px', padding: '8px 10px', lineHeight: '18px', margin: 0 }}>
                            Tienes {pctEquipo ? `${pctEquipo} % de` : 'tu'} descuento por ser parte del equipo Caprichos. No aplica a combos, promociones ni productos que ya tienen descuento.
                          </div>
                        )}

                    {primeraCompra && !tieneSesion && (
                      <div role="note" style={{ fontSize: '13px', color: 'var(--cp-navy)', background: 'var(--cp-sand)', borderRadius: '8px', padding: '8px 10px', lineHeight: '18px' }}>
                        Tienes {primeraCompra.descuento} de descuento en tu primera compra. Inicia sesión con tu celular para aplicarlo. No aplica a promociones ni combos.
                      </div>
                    )}

                    {modalidad === 'DELIVERY' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>
                          {envioGratisCupon
                            ? `Envío gratis (cupón ${cuponAplicado?.codigo})`
                            : envioGratisPromo && promoEnvio
                              ? `Envío gratis (promoción): ${promoEnvio.nombre}`
                              : 'Costo de envío'}
                        </span>
                        <span style={{ fontWeight: 700 }}>
                          {envioGratisActivo
                            ? 'S/ 0.00'
                            : costoEnvio !== null
                              ? costoEnvio === 0
                                ? 'GRATIS'
                                : `S/ ${costoEnvio.toFixed(2)}`
                              : 'Envío por confirmar: se calcula al recibir tu ubicación'}
                        </span>
                      </div>
                    )}

                    {creditoConDelivery && (
                      <div data-testid="credito-resumen" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>A tu crédito del personal</span>
                        <span style={{ fontWeight: 700 }}>S/ {productosACredito.toFixed(2)}</span>
                      </div>
                    )}

                    {propinaCobrable > 0 && !conCredito && (
                      <div data-testid="propina-resumen" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>Propina (para el equipo)</span>
                        <span style={{ fontWeight: 700 }}>S/ {propinaCobrable.toFixed(2)}</span>
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
                      <span style={{ color: 'var(--cp-rust)' }}>S/ {aCobrar.toFixed(2)}</span>
                    </div>

                    {clienteCuenta && (
                      <div data-testid="puntos-estimados" style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--cp-soft)' }}>
                        {detalleEquipo ? (
                          <b>Este pedido no suma puntos porque lleva el descuento del equipo.</b>
                        ) : (
                          <>
                            <b>Con este pedido ganarás ~{puntosEstimados.toFixed(2)} pts</b> (0 si usas cupón o es solo promoción).
                          </>
                        )}
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
                flexShrink: 0,
                ...(movil
                  ? {
                      boxShadow: '0 -6px 16px rgba(11, 44, 62, 0.12)',
                      paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
                    }
                  : {}),
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
                  S/ {aCobrar.toFixed(2)}
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

              {localCerrado && (
                <div
                  role="alert"
                  data-testid="aviso-local-cerrado"
                  style={{ backgroundColor: '#FDECEA', color: 'var(--cp-rust)', border: '1.5px solid var(--cp-rust)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, lineHeight: '17px' }}
                >
                  {estadoLocal?.pausaAltaDemanda
                    ? 'Por ahora estamos con muchos pedidos y no podemos recibir más 💛. Tu carrito se queda guardado: vuelve en un ratito.'
                    : `Ya cerramos por hoy 💛 (${estadoLocal?.texto}). Tu carrito se queda guardado para cuando volvamos a abrir.`}
                </div>
              )}

              {/* Stock: productos por encima de lo que queda, con el ajuste del pedido */}
              {(enviarBloqueadoPorStock || stockRechazado) && (
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
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {excesos.map((e) => (
                    <span key={`${e.productoId}-${e.saborId ?? ''}`}>
                      {e.saborId ? mensajeSaborQuedan(e.quedan, e.saborNombre ?? 'este sabor') : mensajeExceso(e)}
                    </span>
                  ))}
                  {pendientesSabor.map((l) => (
                    <span key={l.id}>{`Elige los sabores de ${l.nombre} (${textoSabores(l) || 'aún sin sabores'})`}</span>
                  ))}
                  {stockRechazado && !excesos.some((e) => e.productoId === stockRechazado.productoId) && (
                    <span>{stockRechazado.mensaje}</span>
                  )}
                  <button
                    type="button"
                    onClick={ajustarPedidoAStock}
                    style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Ajustar mi pedido
                  </button>
                </div>
              )}

              {sinModalidadOferta && (
                <div
                  role="alert"
                  data-testid="aviso-oferta-modalidad"
                  style={{ backgroundColor: 'var(--cp-sand)', border: '1.5px solid var(--cp-rust)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, lineHeight: '17px' }}
                >
                  {ofertasNoAplican.map((o) => (
                    <div key={o.id}>{`Esta oferta no aplica para ${NOMBRE_MODALIDAD[modalidad]}: ${o.nombre}. Cambia el tipo de pedido o quítala del carrito.`}</div>
                  ))}
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

              {/* Aviso junto al botón cuando falta elegir la ubicación (el botón queda deshabilitado) */}
              {faltaElegirDireccion && (
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>Elige dónde lo enviamos</div>
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
                    disabled={faltaElegirDireccion}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: faltaElegirDireccion ? 'var(--cp-line)' : 'var(--cp-navy)',
                      color: faltaElegirDireccion ? 'var(--cp-soft)' : 'var(--cp-white)',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: faltaElegirDireccion ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={enviando || enviarBloqueadoPorStock || sinModalidadOferta || localCerrado}
                    onClick={() => void enviarPedido()}
                    style={{
                      flex: 1,
                      minHeight: '48px',
                      borderRadius: '12px',
                      border: 0,
                      backgroundColor: enviando || enviarBloqueadoPorStock || sinModalidadOferta || localCerrado ? 'var(--cp-line)' : 'var(--cp-orange)',
                      color: enviando || enviarBloqueadoPorStock || sinModalidadOferta || localCerrado ? 'var(--cp-soft)' : '#FFFFFF',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: enviando || enviarBloqueadoPorStock || sinModalidadOferta || localCerrado ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {enviando
                      ? 'Enviando pedido...'
                      : localCerrado
                        ? 'Local cerrado por ahora'
                        : enviarBloqueadoPorStock || sinModalidadOferta
                        ? 'Ajusta tu pedido para enviar'
                        : `Enviar pedido · S/ ${aCobrar.toFixed(2)}`}
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
