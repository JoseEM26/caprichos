import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';

/**
 * Botones estándar para respuestas de la IA.
 * Todos cumplen estrictamente el límite de Meta WhatsApp Cloud API (máximo 20 caracteres por título).
 */
export const BOTON_IA_VOLVER_MENU: BotonAccion = {
  id: 'btn_menu',
  titulo: 'Volver al menú', // 15 car <= 20
};

export const BOTON_IA_HABLAR_PERSONA: BotonAccion = {
  id: 'btn_persona',
  titulo: 'Hablar con persona', // 18 car <= 20
};

export const BOTON_IA_HACER_PEDIDO: BotonAccion = {
  id: 'pedir',
  titulo: 'Hacer un pedido', // 15 car <= 20
};

export const BOTON_IA_VER_CARTA: BotonAccion = {
  id: 'carta',
  titulo: 'Ver la carta', // 12 car <= 20
};

/**
 * Conjunto de botones estándar para respuestas normales de la IA (2 botones <= 3).
 */
export const BOTONES_IA_ESTANDAR: BotonAccion[] = [
  BOTON_IA_VOLVER_MENU,
  BOTON_IA_HABLAR_PERSONA,
];

/**
 * Conjunto de botones cuando el cliente manifiesta intención de comprar o pedir (3 botones <= 3).
 */
export const BOTONES_IA_CON_PEDIDO: BotonAccion[] = [
  BOTON_IA_HACER_PEDIDO,
  BOTON_IA_VOLVER_MENU,
  BOTON_IA_HABLAR_PERSONA,
];

/**
 * Catálogo de textos del subsistema de Inteligencia Artificial (Ola 3, Agente G).
 * Vocabulario cercano en español peruano, emojis alineados con el mockup Chatbot.dc.html
 * y estricto apego a límites de longitud de WhatsApp (<= 1024 caracteres en cuerpo).
 */
export const TEXTOS_IA = {
  /**
   * Mensaje cuando el cliente toca "Preguntar algo" en el menú principal.
   * Texto extraído fielmente del prototipo oficial Chatbot.dc.html.
   */
  invitacionPreguntar: (): string => {
    return 'Hola, soy Capri. Dime tu consulta y te ayudo.';
  },

  /**
   * Mensaje de falla cerrada cuando OpenAI arroja un error técnico o timeout.
   */
  /** Tema delicado (reclamo, devolución, descuento, anulación): lo ve una persona. */
  temaDelicadoPersona: (): string => {
    return 'Lamento mucho eso 🙏\nLo vamos a ver con cuidado: te paso con una persona de nuestro equipo para que te ayude.';
  },

  errorConsulta: (): string => {
    return 'Estoy teniendo un problema para ver eso, te paso con una persona.';
  },

  /**
   * Mensaje cuando la IA está apagada por configuración, falta de API key o tope mensual alcanzado.
   */
  iaApagadaODerivada: (): string => {
    return 'Por el momento nuestra asistencia automática para dudas no está disponible. Te voy a transferir con un asesor de nuestro equipo para ayudarte con mucho gusto.';
  },

  /**
   * Mensaje cuando se alcanza el límite horario de preguntas por teléfono.
   */
  limiteHoraAlcanzado: (): string => {
    return 'Has alcanzado el límite de consultas por esta hora. Te paso de inmediato con una persona de nuestro equipo para continuar atendiéndote.';
  },

  /**
   * Respuesta segura ante intentos de inyección de prompt o manipulación de instrucciones.
   */
  defensaInyeccion: (): string => {
    return '¡Hola! Soy Capri, el asistente virtual de Caprichos 🍰. Solo puedo responder dudas sobre nuestra carta, productos, horarios y pedidos. ¿En qué te puedo ayudar hoy?';
  },

  /**
   * Mensaje cuando la consulta es muy compleja o requiere confirmación manual.
   */
  dudaComplejaDerivacion: (): string => {
    return 'Para brindarte una respuesta exacta con respecto a tu consulta, te paso con una persona de nuestro equipo.';
  },

  /**
   * Alerta cuando el cliente pregunta por alérgenos no confirmados en la base de datos.
   */
  alertaAlergenoNoConfirmado: (): string => {
    return 'No tengo ese dato de alérgenos confirmado en este momento. Por precaución médica para tu salud, te paso con una persona del equipo.';
  },

  /**
   * Mensaje de aviso cuando el cliente quiere pedir un producto mediante texto libre.
   */
  avisoHacerPedidoPorBotones: (): string => {
    return '¡Qué delicia! 🍰 Recuerda que para armar tu pedido con todas sus opciones lo hacemos por los botones de nuestro menú interactivo.';
  },
};
