import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';
export { BotonAccion, FilaLista };

/**
 * Versión actual del esquema del objeto `conversacion.flujo`.
 * Permite migraciones de estado fluidas en futuras olas sin invalidar datos previos.
 */
export const ESQUEMA_FLUJO_VERSION = 2;

/**
 * Estados activos de la máquina de estados del bot conversacional de Caprichos.
 *
 * Estados de la Ola 1 y ampliación:
 * - INICIO: Estado inicial al abrir o restablecer una conversación.
 * - MENU: Menú principal del bot con mensaje interactivo de lista ('Ver opciones').
 * - CARTA_CATEGORIAS: Navegación de categorías reales de la carta virtual.
 * - CARTA_PRODUCTOS: Lista de productos reales de una categoría seleccionada.
 * - CARTA_PRODUCTO_DETALLE: Detalle de un producto con sus opciones, tamaños y disponibilidad.
 * - CARTA_PROMOS: Vista de promociones y ofertas vigentes de hoy.
 * - MI_PEDIDO: Solicitud de código de pedido o selección de pedido activo.
 * - MI_PEDIDO_DETALLE: Opciones y estado real del pedido seleccionado.
 * - PREGUNTAS: Menú de preguntas frecuentes del mockup con respuestas desde la BD.
 * - HORARIO: Consulta de horario de atención del local.
 * - UBICACION: Consulta de dirección física y enlace al mapa.
 * - ATENCION_PERSONA: La conversación fue derivada a una persona del equipo (el bot permanece en silencio).
 *
 * Ganchos documentados y estados del mockup Chatbot.dc.html para Olas 2 y 3:
 * - PEDIDO, PAGO, RESERVA, DUDA_IA
 * - MODAL, LOC, CAT, PROD, VARIANT, GROUP, MORE, PROMO, SUMMARY, PAY, CASH, RES_PEOPLE, RES_TIME, MINE, ASK
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
export type TipoEntrada = 'texto' | 'boton' | 'lista';

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

export type AccionMensaje =
  | AccionEnviarTexto
  | AccionEnviarBotones
  | AccionEnviarLista
  | AccionPasarAPersona;

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
  /** Gancho para Ola 2: Carrito y selección de productos */
  pedido?: {
    categoriaId?: string;
    productoId?: string;
    items?: any[];
  } | null;
  /** Gancho para Ola 2: Coordinación de pago */
  pago?: {
    metodo?: string;
    comprobanteArchivoId?: string;
  } | null;
  /** Gancho para Ola 3: Reserva de salón */
  reserva?: {
    fecha?: string;
    hora?: string;
    personas?: number;
  } | null;
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
}

/**
 * Resultado inmutable producido por la función pura de transición.
 */
export interface ResultadoTransicion {
  nuevoEstado: EstadoConversacion;
  acciones: AccionMensaje[];
  nuevoFlujo: FlujoConversacion;
}
