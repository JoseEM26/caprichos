import { IGV_PCT_DEFECTO } from './facturacion.calculo';
import { Proveedor } from '../emisor/emisor.tipos';
import { proveedorDe } from '../emisor/proveedor';

/** Parámetros de facturación electrónica (tabla parametro). Valores por defecto si faltan. */
export const CLAVES_FACTURACION = {
  igv: 'facturacion_igv_pct',
  serieBoleta: 'facturacion_serie_boleta',
  serieFactura: 'facturacion_serie_factura',
  proveedor: 'facturacion_proveedor',
  envioNocturno: 'facturacion_envio_nocturno',
  horaEnvio: 'facturacion_hora_envio',
  horaResumen: 'facturacion_hora_resumen',
} as const;

export const SERIE_BOLETA_DEFECTO = 'B002';
export const SERIE_FACTURA_DEFECTO = 'F002';
/** Hora (Lima, HH:MM) desde la que el lote de la noche emite (el local cierra 22:30). */
export const HORA_ENVIO_DEFECTO = '23:00';
/** Hora (Lima, HH:MM) del resumen diario de boletas: después del lote para que entren las de esa noche. */
export const HORA_RESUMEN_DEFECTO = '23:30';
/** El resumen corre en una ventana de 10 minutos desde su hora; debe empezar al menos 15 min después del lote. */
export const VENTANA_RESUMEN_MIN = 10;
export const MARGEN_LOTE_RESUMEN_MIN = 15;

/** "HH:MM" válido, o una hora entera 0-23 (valor antiguo) como "HH:00". null si no es válido. */
export function horaHHMM(v: unknown): string | null {
  if (typeof v === 'number' || /^\d{1,2}$/.test(String(v ?? ''))) {
    const h = Number(v);
    return Number.isInteger(h) && h >= 0 && h <= 23 ? `${String(h).padStart(2, '0')}:00` : null;
  }
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(v ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Minutos desde la medianoche de un "HH:MM". */
export function minutosDelDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** null si las horas sirven; si no, el motivo en palabras simples. */
export function validarHorasEnvio(horaEnvio: string, horaResumen: string): string | null {
  const r = minutosDelDia(horaResumen);
  if (r + VENTANA_RESUMEN_MIN > 24 * 60) return 'El resumen de boletas debe ser a más tardar a las 23:50';
  if (r < minutosDelDia(horaEnvio) + MARGEN_LOTE_RESUMEN_MIN) {
    return `El resumen de boletas debe ser al menos ${MARGEN_LOTE_RESUMEN_MIN} minutos después del envío de boletas y facturas`;
  }
  return null;
}

export interface ConfigFacturacion {
  igvPct: number;
  serieBoleta: string;
  serieFactura: string;
  /** Proveedor elegido (SIMULADO por defecto). El efectivo puede caer a SIMULADO si falta su configuración. */
  proveedor: Proveedor;
  /** true (defecto): boletas y facturas se emiten en la noche, no al cobrar. false: como antes, al cobrar. */
  envioNocturno: boolean;
  /** Hora Lima (HH:MM) desde la que corre el lote de la noche. */
  horaEnvio: string;
  /** Hora Lima (HH:MM) del resumen diario de boletas. */
  horaResumen: string;
}

/** Serie de SUNAT: boleta B + 3 alfanuméricos, factura F + 3 alfanuméricos. */
export function serieValida(serie: unknown, letra: 'B' | 'F'): boolean {
  return typeof serie === 'string' && new RegExp(`^${letra}[A-Z0-9]{3}$`).test(serie);
}

/** Interpreta los valores guardados; cualquier valor inválido cae al defecto. */
export function interpretarConfig(valores: Record<string, unknown>): ConfigFacturacion {
  const igv = Number(valores[CLAVES_FACTURACION.igv]);
  const serieB = valores[CLAVES_FACTURACION.serieBoleta];
  const serieF = valores[CLAVES_FACTURACION.serieFactura];
  let horaEnvio = horaHHMM(valores[CLAVES_FACTURACION.horaEnvio]) ?? HORA_ENVIO_DEFECTO;
  let horaResumen = horaHHMM(valores[CLAVES_FACTURACION.horaResumen]) ?? HORA_RESUMEN_DEFECTO;
  // Par guardado inválido (p. ej. resumen antes del lote): vuelven los dos al defecto
  if (validarHorasEnvio(horaEnvio, horaResumen)) [horaEnvio, horaResumen] = [HORA_ENVIO_DEFECTO, HORA_RESUMEN_DEFECTO];
  return {
    igvPct: Number.isFinite(igv) && igv >= 0 && igv <= 100 ? igv : IGV_PCT_DEFECTO,
    serieBoleta: serieValida(serieB, 'B') ? (serieB as string) : SERIE_BOLETA_DEFECTO,
    serieFactura: serieValida(serieF, 'F') ? (serieF as string) : SERIE_FACTURA_DEFECTO,
    proveedor: proveedorDe(valores[CLAVES_FACTURACION.proveedor]),
    envioNocturno: !['no', 'NO', false, 'false'].includes(valores[CLAVES_FACTURACION.envioNocturno] as any),
    horaEnvio,
    horaResumen,
  };
}
