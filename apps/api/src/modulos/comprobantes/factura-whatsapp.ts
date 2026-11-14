/**
 * Envío automático de la factura al WhatsApp del cliente (funciones puras, sin base ni red).
 * El celular del pedido ES su WhatsApp. Sin celular válido no se envía nada.
 */
/** Relleno histórico de los pedidos sin celular: no es un número real. */
const TELEFONO_PLACEHOLDER = '999999999';

/** Interruptor (parámetro de sistema, booleano). Sin valor guardado: ENCENDIDO (lo pidió el dueño). */
export const CLAVE_FACTURA_WHATSAPP = 'facturacion_enviar_whatsapp';
/** Nombre de la plantilla de Meta (encabezado DOCUMENTO) para clientes con la ventana de 24 h cerrada. Vacío: sin plantilla. */
export const CLAVE_FACTURA_WHATSAPP_PLANTILLA = 'facturacion_whatsapp_plantilla';
export const IDIOMA_PLANTILLA_FACTURA = 'es';

export type EstadoEnvioFactura = 'PENDIENTE' | 'ENVIADO' | 'SIN_CELULAR' | 'SIN_VENTANA' | 'ERROR' | 'APAGADO' | 'OMITIDO';

/** Espera antes de cada reintento (sin ventana o con error temporal): 15 min, 1 h, 4 h y 12 h. Luego se cierra. */
export const ESPERAS_REINTENTO_FACTURA_MS = [15 * 60_000, 60 * 60_000, 4 * 3_600_000, 12 * 3_600_000];

/** Celular peruano de WhatsApp (9 dígitos que empiezan con 9, con o sin 51) listo para enviar, o null. */
export function celularParaFactura(telefono: string | null | undefined): string | null {
  const digitos = String(telefono ?? '').replace(/\D/g, '');
  const nacional = digitos.length === 11 && digitos.startsWith('51') ? digitos.slice(2) : digitos;
  if (!/^9\d{8}$/.test(nacional) || nacional === TELEFONO_PLACEHOLDER) return null;
  return `51${nacional}`;
}

/** Nombre del documento en el chat del cliente: «Factura F002-000123.pdf». */
export const nombreArchivoFactura = (numeroTexto: string, tipo: string = 'FACTURA'): string => `${tipo === 'BOLETA' ? 'Boleta' : 'Factura'} ${numeroTexto}.pdf`;

/** Texto del documento (una línea, sin montos ni RUC). */
export const textoFactura = (numeroTexto: string, tipo: string = 'FACTURA'): string =>
  `Gracias por tu compra en Caprichos 💛 Aquí está tu ${tipo === 'BOLETA' ? 'boleta' : 'factura'} electrónica ${numeroTexto}.`;

/** Boleta o factura: lo que se envía por WhatsApp al emitirse (la nota de venta simple no es electrónica). */
export const esComprobanteEnviable = (tipo: string | null | undefined): boolean => tipo === 'FACTURA' || tipo === 'BOLETA';

/** Nombre de plantilla válido de Meta (minúsculas, números y guion bajo), o '' si no sirve. */
export function plantillaValida(v: unknown): string {
  const t = typeof v === 'string' ? v.trim() : '';
  return /^[a-z0-9_]{1,512}$/.test(t) ? t : '';
}

/** Espera hasta el reintento número `intentos` (1 = el primero), o null si ya no quedan. */
export function esperaReintento(intentos: number): number | null {
  return ESPERAS_REINTENTO_FACTURA_MS[intentos - 1] ?? null;
}

/** Meta o el guardia dicen que la ventana de 24 h está cerrada (mismo criterio que el panel de Mensajes). */
export const esErrorVentana = (codigo?: string | null, detalle?: string | null): boolean =>
  codigo === 'VENTANA_CERRADA' || codigo === 'FUERA_DE_VENTANA_24H' || /131047|24 hours|24-hour/i.test(detalle ?? '');
