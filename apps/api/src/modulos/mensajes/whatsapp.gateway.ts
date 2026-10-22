/**
 * Puerto de salida hacia WhatsApp (ADR-009). El servicio de mensajes solo conoce esta interfaz.
 * Hoy se usa `WhatsAppLocalGateway` (guarda el mensaje en `mensaje_chat`, sin salir a Meta).
 * Cuando lleguen las credenciales de la Cloud API se escribe `WhatsAppCloudGateway` (enviar por
 * Graph API y guardar el `meta_id`) y solo se cambia el `useClass` del proveedor en MensajesModule.
 */
export interface MensajeEnviado {
  id: string;
  autor: 'BOT' | 'PERSONA';
  texto: string;
  en: Date;
  metaId: string | null;
}

export interface WhatsAppGateway {
  enviarTexto(conversacionId: bigint, telefono: string, texto: string, autor: 'BOT' | 'PERSONA'): Promise<MensajeEnviado>;
}

export const WHATSAPP_GATEWAY = 'WHATSAPP_GATEWAY';
