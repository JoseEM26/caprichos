import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';

/**
 * Constantes de límites de WhatsApp Cloud API (Meta):
 * - Botón de lista (action.button): máximo 20 caracteres.
 * - Título de fila de lista (title): máximo 24 caracteres.
 * - Descripción de fila de lista (description): máximo 72 caracteres.
 * - Título de botón de respuesta rápida (quick reply): máximo 20 caracteres.
 * - Máximo de botones por mensaje: 3 botones.
 * - Máximo de filas por mensaje de lista: 10 filas.
 * - Cuerpo del mensaje: máximo 1024 caracteres.
 */
export const LIMITE_TITULO_BOTON = 20;
export const LIMITE_BOTON_LISTA = 20;
export const LIMITE_TITULO_FILA = 24;
export const LIMITE_DESCRIPCION_FILA = 72;
export const LIMITE_MAX_BOTONES = 3;
export const LIMITE_MAX_FILAS = 10;
export const LIMITE_CUERPO_TEXTO = 1024;

/**
 * Textos por defecto del chatbot de Caprichos.
 * Extraídos fielmente del prototipo oficial Chatbot.dc.html y de los documentos de diseño.
 * Conservan los emojis oficiales del mockup para WhatsApp.
 */
export const TEXTOS_BOT_DEFECTO = {
  chatbot_texto_bienvenida:
    'CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁',

  chatbot_texto_despedida:
    'Gracias por comunicarte con Caprichos ☕. ¡Esperamos verte pronto! 🧁',

  chatbot_texto_pase_persona:
    'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.',

  chatbot_texto_fuera_horario:
    'Ahora estamos cerrados. Nuestro horario: {horario}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.',

  chatbot_texto_no_entiendo:
    'No estoy seguro de haber entendido. ¿Qué necesitas? Puedes elegir una opción o escribirme de otra forma.',

  chatbot_texto_no_entiendo_derivacion:
    'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte.',

  chatbot_texto_indicacion_pago:
    'Si pagas por Yape, Plin o transferencia, envíanos aquí la captura de tu comprobante.',

  chatbot_texto_envio_gratis: '🛵 Envío gratis por «{promo}»',

  chatbot_texto_combo_intro: 'Vamos a armar tu *{combo}* 💛\n{incluye}',

  chatbot_texto_combo_plan_b:
    'Hoy no hay {faltante} 😅 ¿Lo cambiamos por {alternativas}? El precio de tu combo no cambia.',
} as const;

export type ClaveTextoBot = keyof typeof TEXTOS_BOT_DEFECTO;

export const CLAVES_TEXTOS_BOT: ClaveTextoBot[] = [
  'chatbot_texto_bienvenida',
  'chatbot_texto_despedida',
  'chatbot_texto_pase_persona',
  'chatbot_texto_fuera_horario',
  'chatbot_texto_no_entiendo',
  'chatbot_texto_no_entiendo_derivacion',
  'chatbot_texto_indicacion_pago',
  'chatbot_texto_envio_gratis',
  'chatbot_texto_combo_intro',
  'chatbot_texto_combo_plan_b',
];

/**
 * Mensajes mostrados cuando una función específica está desactivada.
 * Respetan estrictamente los límites de WhatsApp y conservan emojis amigables.
 */
export const TEXTOS_FUNCIONES_DESACTIVADAS = {
  pedido:
    'La toma de pedidos por WhatsApp está temporalmente pausada. Puedes revisar nuestra carta digital o hablar con un asesor del equipo. 🧁',

  pago:
    'La coordinación automática de pagos está en pausa. Te paso con una persona de Caja para ayudarte a completar tu pago.',

  reservas:
    'Las reservas de mesa por WhatsApp están temporalmente pausadas. Si deseas una mesa, un asesor del equipo te puede ayudar. 🧁',

  cambios:
    'La gestión automática de cambios está temporalmente pausada. Te paso con un asesor del equipo para ayudarte con tu pedido. 🧁',

  ia:
    'Por el momento nuestra asistencia automática para dudas no está disponible. Te voy a transferir con un asesor de nuestro equipo para ayudarte con mucho gusto.',

  promociones:
    'Por el momento no tenemos promociones activas. ¡Revisa nuestra carta para ver todos los productos!',
};

/**
 * Textos y botones para el control de frecuencia y anti-spam.
 */
export const TEXTOS_ANTI_SPAM = {
  avisoExceso: (): string => {
    return 'Has enviado varios mensajes en poco tiempo. Por favor espera unos momentos para que podamos atenderte con gusto. ☕';
  },
};

export const BOTONES_FUNCION_PAUSADA: BotonAccion[] = [
  { id: 'btn_carta', titulo: 'Ver la carta' },
  { id: 'btn_persona', titulo: 'Hablar con asesor' },
  { id: 'btn_menu', titulo: 'Volver al menú' },
];

export const BOTON_AVISO_SPAM_MENU: BotonAccion = {
  id: 'btn_menu',
  titulo: 'Volver al menú',
};

/**
 * Interruptores por función en la configuración del chatbot.
 */
export interface FuncionesBotEstado {
  pedido: boolean;
  pago: boolean;
  reservas: boolean;
  cambios: boolean;
  ia: boolean;
  promociones: boolean;
}

export const FUNCIONES_BOT_DEFECTO: FuncionesBotEstado = {
  pedido: true,
  pago: true,
  reservas: true,
  cambios: true,
  ia: false, // Por defecto la IA requiere activación explícita
  promociones: true,
};

/**
 * Parámetros anti-spam en Redis.
 */
export interface AntiSpamParametros {
  maxPorMinuto: number;
  maxPorHora: number;
}

export const ANTI_SPAM_DEFECTO: AntiSpamParametros = {
  maxPorMinuto: 10,
  maxPorHora: 60,
};

/**
 * Parámetros de privacidad y retención (Ley 29733).
 */
export interface PrivacidadParametros {
  diasRetencion: number;
}

export const PRIVACIDAD_DEFECTO: PrivacidadParametros = {
  diasRetencion: 90,
};

/**
 * Estructura completa de configuración del Chatbot devuelta por el API.
 */
export interface ChatbotConfiguracionCompleta {
  textos: Record<ClaveTextoBot, string>;
  textosDefecto: Record<ClaveTextoBot, string>;
  funciones: FuncionesBotEstado;
  antiSpam: AntiSpamParametros;
  privacidad: PrivacidadParametros;
}
