import type { CargaCarrusel } from '../servicios/carrusel.util';
import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';
import { EstadoCarritoPedido, EstadoPedidoFlujo } from './flujos/pedido/tipos-pedido';
import { EstadoPagoFlujo, EstadoPagoConversacion } from './flujos/pago/tipos-pago';
import { EstadoReservaFlujo, EstadoFlujoReserva } from './flujos/reserva/tipos-reserva';
import { EstadoCambiosFlujo, EstadoFlujoCambios } from './flujos/cambios/tipos-cambios';
export {
  BotonAccion,
  FilaLista,
  EstadoCarritoPedido,
  EstadoPedidoFlujo,
  EstadoPagoFlujo,
  EstadoPagoConversacion,
  EstadoReservaFlujo,
  EstadoFlujoReserva,
  EstadoCambiosFlujo,
  EstadoFlujoCambios,
};

/**
 * Versión actual del esquema del objeto `conversacion.flujo`.
 * Permite migraciones de estado fluidas en futuras olas sin invalidar datos previos.
 */
export const ESQUEMA_FLUJO_VERSION = 2;

/**
 * Estados activos de la máquina de estados del bot conversacional de Caprichos.
 */
export type EstadoConversacion =
  | 'INICIO'
  | 'MENU'
  | 'CARTA_CATEGORIAS'
  | 'CARTA_PRODUCTOS'
  | 'CARTA_PRODUCTO_DETALLE'
  | 'CARTA_PROMOS'
  | 'MI_PEDIDO'
  | 'MI_PEDIDO_DETALLE'
  | 'PREGUNTAS'
  | 'HORARIO'
  | 'UBICACION'
  | 'ATENCION_PERSONA'
  // Ganchos para olas 2 y 3:
  | 'PEDIDO'
  | 'PAGO'
  | 'RESERVA'
  | 'DUDA_IA'
  // Estados de subflujo de pedidos (Ola 2, Agente C):
  | EstadoPedidoFlujo
  // Estados de subflujo de pagos (Ola 2, Agente D):
  | EstadoPagoFlujo
  // Estados de subflujo de reservas (Ola 3, Agente F):
  | EstadoReservaFlujo
  // Estados de subflujo de cambios (Ola 3, Agente E):
  | EstadoCambiosFlujo
  // Estados de mockup Chatbot.dc.html:
  | 'MODAL'
  | 'LOC'
  | 'CAT'
  | 'PROD'
  | 'VARIANT'
  | 'GROUP'
  | 'MORE'
  | 'PROMO'
  | 'SUMMARY'
  | 'PAY'
  | 'CASH'
  | 'RES_PEOPLE'
  | 'RES_TIME'
  | 'MINE'
  | 'ASK';

/**
 * Tipos de entrada reconocidos por el normalizador del motor.
 */
export type TipoEntrada = 'texto' | 'boton' | 'lista' | 'ubicacion' | 'image' | 'imagen';

export interface UbicacionEntrada {
  latitud: number;
  longitud: number;
  nombre?: string;
  direccion?: string;
}

/**
 * Entrada normalizada para procesamiento determinista y puro.
 */
export interface EntradaNormalizada {
  tipo: TipoEntrada;
  /** Texto procesado: en minúsculas, sin tildes, con espacios colapsados */
  texto: string;
  /** Texto original sin alterar */
  textoOriginal: string;
  /** Identificador de botón interactivo o elemento de lista si aplica */
  id?: string;
  /** Coordenadas y dirección geográfica si el cliente compartió ubicación */
  ubicacion?: UbicacionEntrada;
}

/**
 * Acción de respuesta: envío de texto libre dentro de la ventana de 24 horas.
 */
export interface AccionEnviarTexto {
  tipo: 'enviarTexto';
  texto: string;
}

/**
 * Acción de respuesta: envío de mensaje interactivo con hasta 3 botones de respuesta rápida.
 */
export interface AccionEnviarBotones {
  tipo: 'enviarBotones';
  texto: string;
  botones: BotonAccion[];
  /** Solo sale si un carrusel anterior de la misma respuesta salió como carrusel (no cayó al respaldo). */
  soloSiCarruselSalio?: boolean;
}

/**
 * Acción de respuesta: envío de mensaje interactivo de tipo lista (hasta 10 opciones).
 */
export interface AccionEnviarLista {
  tipo: 'enviarLista';
  texto: string;
  botonTexto: string;
  filas: FilaLista[];
  tituloSeccion?: string;
}

/**
 * Acción de respuesta: carrusel interactivo (2 a 10 tarjetas con imagen y «Pedir este»). Si no puede salir,
 * el ejecutor manda `carga.respaldo` (la lista o botones de siempre).
 */
export interface AccionEnviarCarrusel {
  tipo: 'enviarCarrusel';
  carga: CargaCarrusel;
  /** Esta acción solo sale si un carrusel anterior de la misma respuesta sí salió como carrusel. */
  soloSiCarruselSalio?: boolean;
}

/**
 * Acción interna: derivar la conversación a un agente humano en la consola de Mensajes.
 */
export interface AccionPasarAPersona {
  tipo: 'pasarAPersona';
  motivo: string;
  mensajeCliente?: string;
  esUrgente?: boolean;
  crearQueja?: boolean;
  quejaTexto?: string;
}

/**
 * Acción transaccional: invocar la creación del pedido en PedidosService.
 */
export interface AccionCrearPedido {
  tipo: 'crearPedido';
  dto: any;
  claveIdempotencia: string;
  tiempoEstimadoMin: number;
  tiempoEstimadoMax: number;
  esPagoDigital: boolean;
  datosPagoTexto?: string;
}

/**
 * Acción transaccional: registrar una solicitud de reserva pendiente en SolicitudReserva (Ola 3, Agente F).
 */
export interface AccionCrearSolicitudReserva {
  tipo: 'crearSolicitudReserva';
  personas: number;
  fechaIso: string;
  fechaTexto: string;
  hora: string;
  nombre: string;
  telefono: string;
  nota?: string;
}

/**
 * Acción transaccional: cancelar una reserva activa del cliente por WhatsApp.
 */
export interface AccionCancelarReservaCliente {
  tipo: 'cancelarReservaCliente';
  reservaId: string;
  motivo?: string;
}

/**
 * Acción transaccional: solicitar cambio de una reserva activa del cliente.
 */
export interface AccionCambiarReservaCliente {
  tipo: 'cambiarReservaCliente';
  reservaId: string;
  detalle: string;
}

/**
 * Acción de respuesta: envío de imagen (ej. código QR de pago o voucher).
 */
export interface AccionEnviarImagen {
  tipo: 'enviarImagen';
  url: string;
  caption?: string;
}

/**
 * Acción transaccional: registrar una solicitud de cambio de pedido o dirección (Ola 3, Agente E).
 */
export interface AccionCrearSolicitudCambio {
  tipo: 'crearSolicitudCambio';
  pedidoId: string;
  pedidoCodigo: string;
  tipoCambio: 'DIRECCION' | 'PEDIDO' | 'CANCELAR';
  detalle: string;
  nuevaDireccion?: string;
  nuevaReferencia?: string;
  nuevaZonaId?: string;
  nuevaZonaNombre?: string;
  nuevoEnvio?: number;
  recargoEnvio?: number;
  lat?: number;
  lng?: number;
}

/**
 * Acción de consulta a la Inteligencia Artificial (Ola 3, Agente G).
 */
export interface AccionConsultarIa {
  tipo: 'consultarIa';
  pregunta: string;
}

/**
 * Acción interna: crear la cuenta del cliente con el celular de la conversación, sin contraseña (consentimiento
 * aceptado en el chat). El ejecutor responde con el mensaje de «cuenta creada» o el de error.
 */
export interface AccionCrearCuentaCliente {
  tipo: 'crearCuentaCliente';
  nombre: string;
}

export type AccionMensaje =
  | AccionCrearCuentaCliente
  | AccionEnviarTexto
  | AccionEnviarBotones
  | AccionEnviarLista
  | AccionEnviarCarrusel
  | AccionEnviarImagen
  | AccionPasarAPersona
  | AccionCrearPedido
  | AccionCrearSolicitudReserva
  | AccionCancelarReservaCliente
  | AccionCambiarReservaCliente
  | AccionCrearSolicitudCambio
  | AccionConsultarIa;

/**
 * Estructura tipada del objeto JSON guardado en `conversacion.flujo`.
 */
export interface FlujoConversacion {
  version: number;
  estado: EstadoConversacion;
  repreguntasFallidas: number;
  nombre_perfil_wa?: string;
  ultimo_wa_message_id?: string;
  codigoPedido?: string;
  categoriaSeleccionadaId?: string;
  paginaCategorias?: number;
  paginaProductos?: number;
  productoSeleccionadoId?: string;
  /** Subflujo transaccional de Pedido (Ola 2, Agente C) */
  pedido?: EstadoCarritoPedido | null;
  /** Subflujo transaccional de Pago (Ola 2, Agente D) */
  pago?: EstadoPagoConversacion | null;
  /** Subflujo transaccional de Reserva (Ola 3, Agente F) */
  reserva?: EstadoFlujoReserva | null;
  /** Subflujo transaccional de Cambios (Ola 3, Agente E) */
  cambios?: EstadoFlujoCambios | null;
  /** Gancho para Ola 3: Contexto de dudas resueltas por IA */
  duda_ia?: {
    historial?: any[];
  } | null;
  [key: string]: any;
}

/** Lo que el servidor averiguó sobre puntos para este mensaje (sin él, el bot no pregunta nada de puntos). */
export interface ContextoPuntosBot {
  porcentaje: number;
  /** Cuenta del propio teléfono de quien escribe, con su saldo */
  cuentaTelefono?: { partyId: string; primerNombre: string; saldo: number } | null;
}

/**
 * Datos operativos del local provistos por LocalService.
 */
export interface DatosHorarioLocal {
  abierta: boolean;
  abre?: string | null;
  cierra?: string | null;
  textoEstado?: string;
  direccion: string;
  referencia?: string;
  enlaceMapa: string;
  telefono?: string;
  motivoPausa?: string;
  pausaAltaDemanda?: boolean;
  altaDemandaMinutosExtra?: number;
}

/**
 * Contexto complementario inyectado a las transiciones puras.
 */
/** Vista previa del pedido del bot calculada con las funciones del servidor (ver vista-previa-pedido.util.ts). */
export interface VistaPreviaPedidoBot {
  subtotal: number;
  /** Descuento automático del servidor (promociones con la casilla «Vale también por WhatsApp»). Nunca cupones. */
  descuento: number;
  descuentoNombre: string | null;
  /** Envío a pagar; null = por calcular (zona sin tarifa conocida). */
  envio: number | null;
  /** Delivery con envío 0 (promo de envío gratis por horario o por monto). */
  envioGratis: boolean;
}

export interface ContextoConversacion {
  conversacionId?: string | bigint;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  cartaUrlPublica?: string;
  datosLocal?: DatosHorarioLocal;
  datosLocalPublicos?: any;
  categoriasCarta?: any[];
  ofertas?: any[];
  /** Unidades vendidas por productoId (últimos 90 días), para ordenar los carruseles. */
  ventasProductos?: Record<string, number>;
  pedidoActivo?: any;
  errorServicio?: boolean;
  limiteConsultasExcedido?: boolean;
  pedidosHoyTelefono?: number;
  minutosInactividad?: number;
  inactividadExpirada?: boolean;
  /** Total del pedido en curso con las reglas del servidor (descuento de promo con casilla BOT y envío). Null sin pedido. */
  vistaPreviaPedido?: VistaPreviaPedidoBot | null;
  resultadoEnvio?: {
    cubierto: boolean;
    zona?: any;
    tarifa?: number | null;
    gratisDesde?: number;
  } | null;
  /** Libreta del cliente con cuenta (party resuelto por el teléfono de quien escribe). Sin cuenta: vacío. */
  direccionesCliente?: Array<{
    id: string;
    direccion: string;
    referencia: string | null;
    lat: number | null;
    lng: number | null;
    alias: string | null;
  }> | null;
  resultadoCupon?: {
    valido: boolean;
    descuento?: number;
    cuponId?: string;
    mensaje?: string;
  } | null;
  /** Franjas de reserva disponibles para la fecha y personas seleccionadas */
  franjasDisponiblesReserva?: string[];
  /** Contador de solicitudes de reserva pendientes para el teléfono (máx 3) */
  solicitudesPendientesTelefono?: number;
  /** Contador de solicitudes de cambio pendientes para el teléfono (máx 3) */
  solicitudesCambioPendientesTelefono?: number;
  /** Habilita derivación a la IA para dudas (Ola 3, Agente G) */
  chatbotIaActivo?: boolean;
  /** Puntos del cliente de WhatsApp; ausente = no preguntar por puntos */
  puntos?: ContextoPuntosBot | null;
  /** Reservas activas del cliente para consulta / cambio / cancelación */
  reservasActivasCliente?: Array<{
    id: string;
    fecha: string;
    hora: string;
    personas: number;
    mesas: string[];
  }>;
  /** Interruptores por función en la configuración del chatbot (Ola 4, Agente I) */
  funcionesActivas?: {
    pedido: boolean;
    pago: boolean;
    reservas: boolean;
    cambios: boolean;
    ia: boolean;
    promociones: boolean;
  };
  /** Textos configurados/personalizados del bot de WhatsApp (Ola 4, Agente I) */
  textosPersonalizados?: Record<string, string>;
  /** Modo asistido activo: conversación en ATENCION_PERSONA sin respuesta humana */
  modoAsistido?: boolean;
  /** Indica si un humano habló recientemente (< 3 min) en una conversación en ATENCION_PERSONA */
  humanoHabloReciente?: boolean;
  /** Indica si el chat está tomado por un asesor activo */
  chatTomado?: boolean;
  /** Minutos transcurridos sin respuesta de una persona */
  minutosSinHumano?: number;
  /** Umbral en minutos configurado para modo asistido (defecto 3) */
  asistidoEsperaMin?: number;
  /** Indica si la frase fija del modo asistido ya fue enviada recientemente (< 3 min) */
  modoAsistidoFraseReciente?: boolean;
}

/**
 * Resultado inmutable producido por la función pura de transición.
 */
export interface ResultadoTransicion {
  nuevoEstado: EstadoConversacion;
  acciones: AccionMensaje[];
  nuevoFlujo: FlujoConversacion;
}

