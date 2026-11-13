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
} as const;

export const SERIE_BOLETA_DEFECTO = 'B002';
export const SERIE_FACTURA_DEFECTO = 'F002';
/** Hora (Lima) desde la que el lote de la noche emite. Antes de las 23:30, hora del resumen diario de boletas (el local cierra 22:30). */
export const HORA_ENVIO_DEFECTO = 23;

export interface ConfigFacturacion {
  igvPct: number;
  serieBoleta: string;
  serieFactura: string;
  /** Proveedor elegido (SIMULADO por defecto). El efectivo puede caer a SIMULADO si falta su configuración. */
  proveedor: Proveedor;
  /** true (defecto): boletas y facturas se emiten en la noche, no al cobrar. false: como antes, al cobrar. */
  envioNocturno: boolean;
  /** Hora Lima (0 a 23) desde la que corre el lote de la noche. */
  horaEnvio: number;
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
  const hora = Number(valores[CLAVES_FACTURACION.horaEnvio] ?? HORA_ENVIO_DEFECTO);
  return {
    igvPct: Number.isFinite(igv) && igv >= 0 && igv <= 100 ? igv : IGV_PCT_DEFECTO,
    serieBoleta: serieValida(serieB, 'B') ? (serieB as string) : SERIE_BOLETA_DEFECTO,
    serieFactura: serieValida(serieF, 'F') ? (serieF as string) : SERIE_FACTURA_DEFECTO,
    proveedor: proveedorDe(valores[CLAVES_FACTURACION.proveedor]),
    envioNocturno: !['no', 'NO', false, 'false'].includes(valores[CLAVES_FACTURACION.envioNocturno] as any),
    horaEnvio: Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : HORA_ENVIO_DEFECTO,
  };
}
