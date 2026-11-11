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
  ): Promise<MensajeEnviado>;

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
