import type { DatosComprobante } from '../facturacion/facturacion.datos';

/** Proveedor de facturación electrónica (parámetro facturacion_proveedor). */
export type Proveedor = 'SIMULADO' | 'SUNAT';

/** Datos del comprobante que necesita cualquier emisor (montos en céntimos, cliente, serie y número). */
export type DatosEmision = DatosComprobante;

/** Comprobante a emitir, con lo que ya guardó el servicio. */
export interface ComprobanteEmision {
  id: bigint;
  tipo: 'BOLETA' | 'FACTURA';
  serie: string;
  numero: number;
  intentos: number;
  datos: DatosEmision;
  /** ZIP ya firmado de un intento anterior: se reenvía tal cual (no se vuelve a firmar). */
  zipPrevio?: Buffer | null;
  /** Guarda XML y ZIP ANTES de la llamada de red: si el proceso muere al enviar, el ZIP queda para reenviar. */
  alPreparar?: (archivos: ArchivoEmision[]) => Promise<void>;
  /** Tiempo máximo de cada llamada de red (ver TIMEOUT_SUNAT_INTERACTIVO_MS y TIMEOUT_SUNAT_MS). */
  timeoutMs?: number;
}

/** Archivo que el emisor entrega para guardar (XML firmado, ZIP enviado, CDR de SUNAT). */
export interface ArchivoEmision {
  tipo: 'XML' | 'ZIP' | 'CDR';
  nombre: string;
  contenido: Buffer;
}

/**
 * Resultado normalizado de un envío. El servicio lo guarda en la fila del comprobante.
 * - EMITIDO_SUNAT: aceptado.  - RECHAZADO: SUNAT o el emisor lo rechazó (con motivo).
 * - PENDIENTE_ENVIO: sin respuesta (red o tiempo agotado): se reintenta.
 * - PENDIENTE_RESUMEN: boleta firmada, se reporta en el resumen diario.
 */
export interface ResultadoEmision {
  estado: 'EMITIDO_SUNAT' | 'RECHAZADO' | 'PENDIENTE_ENVIO' | 'PENDIENTE_RESUMEN';
  respuesta: string;
  simulado: boolean;
  enlacePdf?: string | null;
  cadenaQr?: string | null;
  hash?: string | null;
  archivos?: ArchivoEmision[];
  /** Totales en céntimos (los necesita el resumen diario de boletas). */
  totalCents?: number;
  igvCents?: number;
  /** Código SUNAT del rechazo (CDR o fault), para decidir si reintentar sirve. */
  codigoRechazo?: string | null;
  /** SUNAT ya tenía la factura (1033): EMITIDO_SUNAT sin CDR; hay que verificarla en SOL. */
  yaRegistrado?: boolean;
  /** La consulta previa (getStatusCdr) falló antes de reenviar el mismo ZIP. */
  consultaCdrFallo?: boolean;
}

/** Resultado de una anulación: SOLICITADA (en proceso de SUNAT), ACEPTADA, RECHAZADA o PENDIENTE_RESUMEN. */
export interface ResultadoBaja {
  estado: 'SOLICITADA' | 'ACEPTADA' | 'RECHAZADA' | 'PENDIENTE_RESUMEN';
  respuesta: string;
  /** Comunicación de baja firmada (RA) que hay que enviar como resumen. Solo facturas. */
  resumen?: { nombre: string; xml: Buffer; zip: Buffer } | null;
}

/** Interfaz común de los emisores: SUNAT directo y simulado. */
export interface EmisorElectronico {
  readonly proveedor: Proveedor;
  generar(c: ComprobanteEmision): Promise<ResultadoEmision>;
  /** Consulta si el emisor ya tiene el comprobante, antes de reenviar. null si no aplica. */
  consultar(c: Pick<ComprobanteEmision, 'tipo' | 'serie' | 'numero' | 'timeoutMs'>): Promise<ResultadoEmision | null>;
  anular(c: ComprobanteEmision, motivo: string): Promise<ResultadoBaja>;
}

/** No hubo respuesta usable del emisor (red, tiempo agotado, 5xx): el envío queda pendiente. */
export class ErrorRedEmisor extends Error {
  constructor(mensaje = 'No hubo respuesta del emisor electrónico (red o tiempo agotado)') {
    super(mensaje);
  }
}

/** SUNAT rechazó las credenciales (usuario SOL o clave): se pausan los envíos y se avisa. No es un rechazo del comprobante. */
export class ErrorCredencialesEmisor extends Error {
  constructor(mensaje = 'SUNAT rechazó las credenciales (usuario o clave SOL)') {
    super(mensaje);
  }
}
