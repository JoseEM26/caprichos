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

  estaConectado?(): { conectado: boolean; modo: 'meta' | 'simulado'; razon?: string };
}

export const WHATSAPP_GATEWAY = 'WHATSAPP_GATEWAY';
