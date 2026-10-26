import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';

/**
 * Versión actual del esquema del objeto `conversacion.flujo`.
 * Permite migraciones de estado fluidas en futuras olas sin invalidar datos previos.
 */
export const ESQUEMA_FLUJO_VERSION = 1;

/**
 * Estados activos de la máquina de estados del bot conversacional de Caprichos.
 *
 * Estados de la Ola 1:
 * - INICIO: Estado inicial al abrir o restablecer una conversación.
 * - MENU: Menú principal del bot con las opciones troncales.
 * - HORARIO: Consulta de horario de atención del local.
 * - UBICACION: Consulta de dirección física y enlace al mapa.
 * - ATENCION_PERSONA: La conversación fue derivada a una persona del equipo (el bot permanece en silencio).
 *
 * Ganchos vacíos y documentados para olas posteriores:
 * - PEDIDO: Navegación de categorías, productos, opciones y carrito (Ola 2, FT-BOT-01).
 * - PAGO: Envío de datos bancarios/billeteras y recepción de comprobantes (Ola 2, FT-BOT-02).
 * - RESERVA: Gestión de reservas de mesa por WhatsApp (Ola 3).
 * - DUDA_IA: Asistente con modelo de lenguaje para responder dudas de la carta (Ola 3, FT-BOT-03).
 */
export type EstadoConversacion =
  | 'INICIO'
  | 'MENU'
  | 'HORARIO'
  | 'UBICACION'
  | 'ATENCION_PERSONA'
  // Ganchos para olas 2 y 3:
  | 'PEDIDO'
  | 'PAGO'
  | 'RESERVA'
  | 'DUDA_IA';

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
  enlaceMapa: string;
  motivoPausa?: string;
  pausaAltaDemanda?: boolean;
}

/**
 * Contexto complementario inyectado a las transiciones puras.
 */
export interface ContextoConversacion {
  nombreCliente?: string | null;
  cartaUrlPublica?: string;
  datosLocal?: DatosHorarioLocal;
}

/**
 * Resultado inmutable producido por la función pura de transición.
 */
export interface ResultadoTransicion {
  nuevoEstado: EstadoConversacion;
  acciones: AccionMensaje[];
  nuevoFlujo: FlujoConversacion;
}
