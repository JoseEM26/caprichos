/**
 * Puerto de salida hacia WhatsApp (ADR-009).
 * El servicio de mensajes solo conoce esta interfaz.
 */
export interface MensajeEnviado {
  id: string;
  autor: 'BOT' | 'PERSONA';
  texto: string;
  en: Date;
  metaId: string | null;
  estado?: string;
  errorCodigo?: string | null;
  errorDetalle?: string | null;
  modo?: 'meta' | 'simulado';
  whatsappMensajeId?: bigint | null;
}

export interface WhatsAppGateway {
  enviarTexto(
    conversacionId: bigint,
    telefono: string,
    texto: string,
    autor: 'BOT' | 'PERSONA',
    /** Id que generó la web para este mensaje: se guarda en el contenido para que la bandeja reconozca su mensaje «Enviando…». */
    idCliente?: string,
  ): Promise<MensajeEnviado>;

  /**
   * Solo habla con WhatsApp para un mensaje que YA está guardado en mensaje_chat (envío en segundo plano): no crea
   * la fila del chat. Devuelve el resultado con el id de whatsapp_mensaje y el id de Meta para enlazarlos a esa fila.
   */
  transmitirTexto?(conversacionId: bigint, telefono: string, texto: string): Promise<MensajeEnviado>;

  enviarPlantilla?(
    conversacionId: bigint,
    telefono: string,
    plantilla: string,
    variables?: string[] | Record<string, string>,
    autor?: 'BOT' | 'PERSONA',
  ): Promise<MensajeEnviado>;

  enviarBotones?(
    conversacionId: bigint,
    telefono: string,
    texto: string,
    botones: { id: string; titulo: string }[],
    autor?: 'BOT' | 'PERSONA',
  ): Promise<MensajeEnviado>;

  /** Sube la foto a la Media API y la envía con su id; guarda el mensaje saliente con la miniatura (archivoId). */
  enviarImagen?(
    conversacionId: bigint,
    telefono: string,
    imagen: Buffer,
    mime: string,
    subtitulo: string,
    autor: 'BOT' | 'PERSONA',
    archivoId: string,
    phoneNumberId?: string,
  ): Promise<MensajeEnviado>;

  /** Sube el documento a la Media API y lo envía con su id y nombre; guarda el mensaje saliente con la tarjeta (documento). */
  enviarDocumento?(
    conversacionId: bigint,
    telefono: string,
    documento: Buffer,
    mime: string,
    nombre: string,
    autor: 'BOT' | 'PERSONA',
    archivoId: string,
    phoneNumberId?: string,
  ): Promise<MensajeEnviado>;

  estaConectado?(): { conectado: boolean; modo: 'meta' | 'simulado'; razon?: string };
}

export const WHATSAPP_GATEWAY = 'WHATSAPP_GATEWAY';
