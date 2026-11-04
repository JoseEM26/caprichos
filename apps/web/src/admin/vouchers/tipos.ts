export type SemaforoVoucher =
  | 'CONFIABLE'
  | 'OBSERVADO'
  | 'RARO'
  | 'ILEGIBLE'
  | 'SIN_LECTURA';

export type MedioPagoVoucher = 'YAPE' | 'PLIN';

export type OrigenVoucher = 'MOZO' | 'WHATSAPP' | 'CAJA' | 'CARTA';

export interface VoucherExtraido {
  legible: boolean;
  monto: number | null;
  moneda?: string;
  operacion: string | null;
  fecha: string | null;
  hora: string | null;
  titular: string | null;
  destinoNumero: string | null;
  medioDetectado: 'YAPE' | 'PLIN' | 'OTRO' | null;
  confianza: number;
  notas?: string;
}

export interface RespuestaSubirVoucherMozo {
  id: string | number;
  legible: boolean;
  mensaje?: string;
  /** true si la lectura automática no estuvo disponible: Caja revisa el voucher a mano. */
  revisionManual?: boolean;
  /** Avisos en texto de lo que no cuadra (monto, medio, destinatario, fecha, duplicado). Nunca semáforo ni datos. */
  avisos?: string[];
}

export interface RespuestaSubirVoucherAdmin {
  id: string | number;
  legible: boolean;
  semaforo: SemaforoVoucher;
  motivos: string[];
  extraido: VoucherExtraido;
  archivoId?: string | number;
  medio?: string;
}

export type RespuestaSubirVoucher =
  | RespuestaSubirVoucherMozo
  | RespuestaSubirVoucherAdmin;

export interface VoucherPagoItem {
  id: string | number;
  pedidoId?: string | number | null;
  conversacionId?: string | number | null;
  mensajeId?: string | number | null;
  archivoId: string | number;
  origen: OrigenVoucher;
  medio?: 'YAPE' | 'PLIN' | null;
  subidoPor?: string | number | null;
  hashImagen?: string | null;
  /** Código de operación vigente (la lectura de la IA o el que confirmó Caja). */
  operacion?: string | null;
  extraido?: VoucherExtraido | null;
  semaforo: SemaforoVoucher;
  motivos: string[];
  revisadoEn?: string | null;
  revisadoPor?: string | number | null;
  creadoEn: string;
}

export interface VoucherResumenChat {
  id: string | number;
  semaforo: SemaforoVoucher;
  motivos: string[];
  extraido?: VoucherExtraido | null;
  medio?: string | null;
  pedidoTotal?: number | null;
  archivoId?: string | number | null;
  revisadoEn?: string | null;
}

export interface ParametrosVoucherConfig {
  voucher_ia_activo: boolean;
  voucher_titular_nombre: string;
  voucher_yape_numero: string;
  voucher_plin_numero: string;
  /** Tope mensual de gasto en IA (USD). Defecto 20. */
  chatbot_ia_tope_mensual_usd?: number;
  /** Minutos de pausa del corte automático. Defecto 10. */
  voucher_ia_corte_min?: number;
}
