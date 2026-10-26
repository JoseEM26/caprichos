import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';
import { EstadoCarritoPedido, EstadoPedidoFlujo } from './flujos/pedido/tipos-pedido';
import { EstadoPagoFlujo, EstadoPagoConversacion } from './flujos/pago/tipos-pago';
import { EstadoReservaFlujo, EstadoFlujoReserva } from './flujos/reserva/tipos-reserva';
export {
  BotonAccion,
  FilaLista,
  EstadoCarritoPedido,
  EstadoPedidoFlujo,
  EstadoPagoFlujo,
  EstadoPagoConversacion,
  EstadoReservaFlujo,
  EstadoFlujoReserva,
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
 * Acción interna: derivar la conversación a un agente humano en la consola de Mensajes.
 */
export interface AccionPasarAPersona {
  tipo: 'pasarAPersona';
  motivo: string;
  mensajeCliente?: string;
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

export type AccionMensaje =
  | AccionEnviarTexto
  | AccionEnviarBotones
  | AccionEnviarLista
  | AccionEnviarImagen
  | AccionPasarAPersona
  | AccionCrearPedido
  | AccionCrearSolicitudReserva
  | AccionCancelarReservaCliente
  | AccionCambiarReservaCliente;

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
  /** Gancho para Ola 3: Contexto de dudas resueltas por IA */
  duda_ia?: {
    historial?: any[];
  } | null;
  [key: string]: any;
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
export interface ContextoConversacion {
  conversacionId?: string | bigint;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  cartaUrlPublica?: string;
  datosLocal?: DatosHorarioLocal;
  datosLocalPublicos?: any;
  categoriasCarta?: any[];
  ofertas?: any[];
  pedidoActivo?: any;
  errorServicio?: boolean;
  limiteConsultasExcedido?: boolean;
  pedidosHoyTelefono?: number;
  minutosInactividad?: number;
  inactividadExpirada?: boolean;
  resultadoEnvio?: {
    cubierto: boolean;
    zona?: any;
    tarifa?: number | null;
    gratisDesde?: number;
  } | null;
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
  /** Reservas activas del cliente para consulta / cambio / cancelación */
  reservasActivasCliente?: Array<{
    id: string;
    fecha: string;
    hora: string;
    personas: number;
    mesas: string[];
  }>;
}

/**
 * Resultado inmutable producido por la función pura de transición.
 */
export interface ResultadoTransicion {
  nuevoEstado: EstadoConversacion;
  acciones: AccionMensaje[];
  nuevoFlujo: FlujoConversacion;
}

