/**
 * Estados del subflujo transaccional de Pago y Validación de Comprobante (Ola 2, Agente D - FT-BOT-02).
 */
export type EstadoPagoFlujo =
  | 'PAGO_DATOS'
  | 'PAGO_ESPERANDO_VOUCHER'
  | 'PAGO_VALIDANDO'
  | 'VALIDAR_PAGO'
  | 'PAGO_RECHAZADO'
  | 'PAGO_CAMBIAR_MEDIO';

/**
 * Estado guardado en `conversacion.flujo.pago` para coordinar el pago por WhatsApp.
 */
export interface EstadoPagoConversacion {
  pedidoId?: string;
  pedidoCodigo?: string;
  medio?: string;
  monto?: number;
  pagaCon?: number;
  capturasEnviadas: number;
  intentosRechazo: number;
  ultimoMotivoRechazo?: string;
  recordatorioEnviado?: boolean;
  expiracionAlertada?: boolean;
  timestampCreacion?: number;
  timestampUltimoVoucher?: number;
  qrUrl?: string;
  datosPagoTexto?: string;
  comprobanteArchivoId?: string;
}

/**
 * Límites de seguridad y protección para pagos por WhatsApp (FT-BOT-02)
 */
export const MAX_CAPTURAS_VOUCHER = 5;
export const MAX_INTENTOS_RECHAZO = 3;
export const MAX_BYTES_VOUCHER = 5 * 1024 * 1024; // 5 MB
export const MIMES_VOUCHER_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
