import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { calcularTotalPedido } from '@caprichos/compartido';
import { api, ErrorApi } from '../comun/api';
import { MapaUbicacion } from '../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../comun/mapa/BuscadorDireccion';
import { enlaceGoogleMaps } from '../comun/mapa/leaflet';
import { useCarrito } from './CarritoContext';
import { PuntosCanje } from './cuenta/PuntosCanje';
import { useCuentaOpcional } from './cuenta/CuentaContext';
import {
  ConsultaEnvioRespuesta,
  DatosLocalCarta,
  EstadoLocalCarta,
  MetodoPago,
  ModalidadEntrega,
  TipoComprobante,
} from './tipos';

interface FormularioCheckoutProps {
  estadoLocal: EstadoLocalCarta | null;
  datosLocal: DatosLocalCarta | null;
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

  // Modalidad (DELIVERY o RECOGER)
  const [modalidad, setModalidad] = useState<ModalidadEntrega>('DELIVERY');

  // Cliente
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  // Entrega
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [zonaEnvio, setZonaEnvio] = useState<string | null>(null);
  const [costoEnvio, setCostoEnvio] = useState<number | null>(null);
  const [cargandoGps, setCargandoGps] = useState(false);
  const [mensajeGps, setMensajeGps] = useState<string | null>(null);
  const [origenPunto, setOrigenPunto] = useState<'GPS' | 'MAPA'>('GPS');
  const [mapaVisible, setMapaVisible] = useState(false);
  const [ubicacionConfirmada, setUbicacionConfirmada] = useState(false);

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
  const [promos, setPromos] = useState<{ total: number; detalles: { nombre: string; monto: number }[] }>({ total: 0, detalles: [] });
  const cuentaCtx = useCuentaOpcional();
  const [mensajeCupon, setMensajeCupon] = useState<string | null>(null);

  // Idempotency-Key único por intento
  const claveIdempotenciaRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  );

  // Prevención de doble toque estricta
  const peticionEnCursoRef = useRef(false);

  // lo que descontará el servidor (promociones automáticas y cupón), para mostrar el mismo total que se cobra
  const clavePromos = JSON.stringify([lineas.map((l) => [l.productoId, l.cantidad, l.subtotal]), cuponAplicado?.codigo]);
  useEffect(() => {
    if (!checkoutAbierto || lineas.length === 0) return;
    let vigente = true;
    api
      .post<{ descuentoTotal: number; detalles: { nombre: string; monto: number }[] }>('/carta/descuentos/vista-previa', {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, subtotal: l.subtotal, precioUnitario: l.precioUnitario })),
        cuponCodigo: cuponAplicado?.codigo,
      })
      .then((r) => vigente && setPromos({ total: Number(r?.descuentoTotal) || 0, detalles: Array.isArray(r?.detalles) ? r.detalles : [] }))
      .catch(() => vigente && setPromos({ total: 0, detalles: [] }));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAbierto, clavePromos]);

  if (!checkoutAbierto) return null;

  // Cálculo del total
  const costoEnvioEfectivo = modalidad === 'DELIVERY' ? costoEnvio : 0;
  const descuentoCupon = cuponAplicado ? cuponAplicado.descuentoCalculado : 0;
  const totalCalculado = Math.max(
    0,
    Number(
      (
        calcularTotalPedido({
          subtotal,
          envio: costoEnvioEfectivo,
        }) - (promos.total > 0 ? promos.total : descuentoCupon) - (cuponAplicado ? 0 : puntosAplicados)
      ).toFixed(2),
    ),
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

  // Fija el punto de entrega (GPS, búsqueda o toque en el mapa) y consulta la zona y el envío
  const fijarPunto = async (lat: number, lng: number, origen: 'GPS' | 'MAPA') => {
    setCoordenadas({ lat, lng });
    setOrigenPunto(origen);
    setMapaVisible(true);
    setUbicacionConfirmada(false);

    try {
      const res = await api.get<ConsultaEnvioRespuesta>(`/carta/envio?lat=${lat}&lng=${lng}`);

      if (!res.cubierto) {
        setZonaEnvio(null);
        setCostoEnvio(null);
        setMensajeGps('FUERA_DE_COBERTURA: Tu ubicación está fuera de la zona de reparto');
      } else {
        setZonaEnvio(res.zona);
        // Si el subtotal supera gratisDesde
        const tarifaFinal = subtotal > res.gratisDesde ? 0 : res.tarifa;
        setCostoEnvio(tarifaFinal);
        setMensajeGps(
          `Ubicación encontrada (Envío: ${
            tarifaFinal === 0 ? 'GRATIS' : `S/ ${tarifaFinal?.toFixed(2)}`
          })`,
        );
      }
    } catch {
      setMensajeGps('No se pudo verificar la zona de envío. Se coordinará por WhatsApp.');
      setCostoEnvio(null);
    }
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
        await fijarPunto(pos.coords.latitude, pos.coords.longitude, 'GPS');
        setCargandoGps(false);
      },
      () => {
        setCargandoGps(false);
        setMensajeGps('No fue posible conseguir la ubicación. Escribe tu dirección o márcala en el mapa.');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // Validaciones del formulario
  const validarFormulario = (): string | null => {
    if (!nombre.trim()) {
      return 'El nombre es obligatorio';
    }

    const telLimpio = telefono.trim();
    if (!/^9\d{8}$/.test(telLimpio)) {
      return 'El teléfono debe tener 9 dígitos y empezar con 9';
    }

    if (modalidad === 'DELIVERY') {
      if (!coordenadas && direccion.trim().length < 5) {
        return 'Para delivery debes indicar una dirección de al menos 5 caracteres o usar tu ubicación';
      }
      if (coordenadas && !ubicacionConfirmada) {
        return 'Confirma con «Mi pedido llega aquí» que el punto rojo es donde recibirás tu pedido';
      }
    }

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

  // Enviar pedido a la API
  const enviarPedido = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    // Verificación de doble toque
    if (peticionEnCursoRef.current || enviando) {
      return;
    }

    // Carta cerrada
    if (estadoLocal && (!estadoLocal.abierta || estadoLocal.pausaAltaDemanda)) {
      setErrorEnvio('La carta se encuentra cerrada o en pausa: no se pueden enviar pedidos.');
      return;
    }

    const error = validarFormulario();
    if (error) {
      setErrorEnvio(error);
      return;
    }

    setErrorEnvio(null);
    setEnviando(true);
    peticionEnCursoRef.current = true;

    // Transformar líneas del carrito al DTO de la API
    // Si DT-62 aplicó (unidades con diferentes opciones), cada unidad se envía como una línea separada
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
        });
      }
    }

    const payload = {
      cliente: {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
      },
      modalidad,
      entrega:
        modalidad === 'DELIVERY'
          ? {
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
      });
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'PRODUCTO_AGOTADO') {
          setErrorEnvio(err.message || 'Uno de los productos seleccionados se encuentra agotado.');
        } else if (err.codigo === 'CARTA_CERRADA') {
          setErrorEnvio('La carta se encuentra cerrada. No es posible enviar pedidos ahora.');
        } else if (err.codigo === 'FUERA_DE_COBERTURA') {
          setErrorEnvio('La dirección indicada está fuera de nuestra zona de cobertura.');
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

  const mediosPagoDisponibles = datosLocal?.mediosPago || {
    yape: { activo: true, numero: '999888777' },
    plin: { activo: true, numero: '999888777' },
    efectivo: { activo: true },
    tarjeta: { activo: true },
  };

  return (
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
            }}
          >
            ×
          </button>
        </div>

        {/* Contenido scrolleable del formulario */}
        <form
          onSubmit={enviarPedido}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Paso 1: Modalidad de entrega */}
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

          {/* Paso 2: Datos de contacto */}
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

          {/* Paso 3: Dirección y ubicación (solo si Delivery) */}
          {modalidad === 'DELIVERY' && (
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
                Ubicación para delivery
              </div>

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
                  Dirección escrita
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
                    onClick={() => setMapaVisible((v) => !v)}
                    aria-expanded={mapaVisible}
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
                    {mapaVisible ? 'Ocultar el mapa' : 'Marcar en el mapa'}
                  </button>
                </div>

                {mapaVisible && (
                  <>
                    <BuscadorDireccion
                      onElegir={(p, texto) => {
                        if (!direccion.trim()) setDireccion(texto.split(',').slice(0, 2).join(',').trim());
                        void fijarPunto(p.lat, p.lng, 'MAPA');
                      }}
                    />
                    <MapaUbicacion
                      punto={coordenadas}
                      onCambiar={(p) => void fijarPunto(p.lat, p.lng, 'MAPA')}
                    />
                    {!coordenadas && (
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        Toca el mapa para poner el punto donde recibirás tu pedido; puedes arrastrarlo.
                      </div>
                    )}
                  </>
                )}

                {coordenadas && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                      Revisa que el punto rojo sea donde recibirás tu pedido.{' '}
                      <a href={enlaceGoogleMaps(coordenadas.lat, coordenadas.lng)} target="_blank" rel="noreferrer">
                        Ver en Google Maps
                      </a>
                    </div>
                    {ubicacionConfirmada ? (
                      <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green)' }}>
                        Ubicación confirmada
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUbicacionConfirmada(true)}
                        disabled={costoEnvio === null && mensajeGps?.includes('FUERA_DE_COBERTURA')}
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

          {/* Paso 4: Comprobante Boleta o Factura (DT-77) */}
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

          {/* Paso 5: Medio de pago */}
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
                      '999888777'}
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
                        '999888777',
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
                    Cuenta: {mediosPagoDisponibles.transferencia?.cuenta || '191-00000000-0-00'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copiarTexto(
                      mediosPagoDisponibles.transferencia?.cuenta || '191-00000000-0-00',
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

          {/* Campo de cupón */}
          {!cuponAplicado && cuentaCtx && (
            <PuntosCanje
              totalPedido={Math.max(0, subtotal)}
              puntosAplicados={puntosAplicados}
              alAplicar={setPuntosAplicados}
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

            {puntosAplicados > 0 && !cuponAplicado && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                <span>Puntos canjeados</span>
                <span style={{ fontWeight: 700 }}>−S/ {puntosAplicados.toFixed(2)}</span>
              </div>
            )}

            {promos.detalles.length > 0
              ? promos.detalles.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                    <span>{d.nombre}</span>
                    <span style={{ fontWeight: 700 }}>−S/ {d.monto.toFixed(2)}</span>
                  </div>
                ))
              : cuponAplicado && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--cp-rust)' }}>
                    <span>Cupón {cuponAplicado.codigo}</span>
                    <span style={{ fontWeight: 700 }}>−S/ {cuponAplicado.descuentoCalculado.toFixed(2)}</span>
                  </div>
                )}

            {modalidad === 'DELIVERY' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span>Costo de envío{zonaEnvio ? ` (${zonaEnvio})` : ''}</span>
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
          </div>

          {/* Mensaje de error general de la API o validación */}
          {errorEnvio && (
            <div
              role="alert"
              style={{
                backgroundColor: '#FDECEA',
                color: 'var(--cp-rust)',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: '18px',
              }}
            >
              {errorEnvio}
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="submit"
              disabled={enviando}
              style={{
                width: '100%',
                minHeight: '52px',
                borderRadius: '12px',
                border: 0,
                backgroundColor: enviando ? 'var(--cp-line)' : 'var(--cp-orange)',
                color: enviando ? 'var(--cp-soft)' : '#FFFFFF',
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '16px',
                cursor: enviando ? 'not-allowed' : 'pointer',
              }}
            >
              {enviando ? 'Enviando pedido...' : `Enviar pedido · S/ ${totalCalculado.toFixed(2)}`}
            </button>

            <button
              type="button"
              onClick={() => {
                cerrarCheckout();
                abrirCajon();
              }}
              style={{
                minHeight: '44px',
                border: 0,
                backgroundColor: 'transparent',
                color: 'var(--cp-soft)',
                fontSize: '13px',
                fontWeight: 700,
                textDecoration: 'underline',
              }}
            >
              Volver a mi pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
