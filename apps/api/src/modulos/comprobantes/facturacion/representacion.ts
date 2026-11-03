import { AmbienteSunat, ambienteSunat } from '../sunat/sunat.config';

/** Estados en los que el XML ya está firmado: el hash y el QR son los del documento que se envía o se envió. */
export const ESTADOS_CON_FIRMA = ['PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'ENVIADA_RESUMEN', 'EMITIDO_SUNAT'];
/** Estados en los que SUNAT no aceptó el comprobante: no tiene validez hasta regularizarlo. */
export const ESTADOS_REGULARIZAR = ['RECHAZADO', 'REVISION_MANUAL'];

export type SituacionRepresentacion = 'FIRMADO' | 'EN_PROCESO' | 'REGULARIZAR';

export interface RepresentacionComprobante {
  situacion: SituacionRepresentacion;
  /** Título de la representación impresa (o el aviso que la reemplaza). */
  titulo: string;
  /** Hash (código de resumen): solo si el XML ya está firmado y no está rechazado. */
  hash: string | null;
  cadenaQr: string | null;
  /** Marca «DOCUMENTO DE PRUEBA»: comprobante simulado o ambiente beta de SUNAT. */
  prueba: boolean;
}

/**
 * Qué se muestra de una BOLETA/FACTURA en el ticket y en el PDF. Regla única:
 * - Firmado (PENDIENTE_ENVIO, PENDIENTE_RESUMEN, ENVIADA_RESUMEN, EMITIDO_SUNAT con hash): hash y QR.
 * - Sin firmar todavía: «en proceso», sin hash.
 * - RECHAZADO o REVISION_MANUAL: «pendiente de regularizar», sin hash válido.
 */
export function representacionDe(
  c: { tipo: string; facturacion_estado?: string | null; facturacion_hash?: string | null; facturacion_cadena_qr?: string | null; simulado?: boolean | null },
  ambiente: AmbienteSunat = ambienteSunat(),
): RepresentacionComprobante {
  const prueba = !!c.simulado || ambiente === 'beta';
  const estado = c.facturacion_estado ?? null;
  if (estado && ESTADOS_REGULARIZAR.includes(estado)) {
    return { situacion: 'REGULARIZAR', titulo: 'PENDIENTE DE REGULARIZAR: SUNAT no aceptó este comprobante', hash: null, cadenaQr: null, prueba };
  }
  if (!c.facturacion_hash || !estado || !ESTADOS_CON_FIRMA.includes(estado)) {
    return { situacion: 'EN_PROCESO', titulo: 'Comprobante electrónico en proceso de envío a SUNAT', hash: null, cadenaQr: null, prueba };
  }
  const nombre = c.tipo === 'FACTURA' ? 'Factura' : 'Boleta de venta';
  return {
    situacion: 'FIRMADO',
    titulo: `Representación impresa de la ${nombre} electrónica`,
    hash: c.facturacion_hash,
    cadenaQr: c.facturacion_cadena_qr ?? null,
    prueba,
  };
}
