/**
 * Reglas de resiliencia de la facturación electrónica (funciones puras, sin base ni red).
 * Qué espera un reintento, cuándo un rechazo ya no se arregla reintentando y cuándo un
 * comprobante pasa a REVISION_MANUAL (cola de fallos). Nada aquí borra nada.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Esperas entre reintentos de una boleta/factura sin respuesta: 1, 2, 5, 10, 30, 60 min y luego cada 2 h. */
export const ESPERAS_FACTURACION_MS = [1, 2, 5, 10, 30, 60].map((m) => m * MINUTO);
export const ESPERA_MAXIMA_FACTURACION_MS = 2 * HORA;

/** Intentos transitorios (sin respuesta de SUNAT) antes de mandar el comprobante a REVISION_MANUAL. */
export const MAX_INTENTOS_DEFECTO = 12;

/** Fallos seguidos de SUNAT (timeout, 5xx o fault de servidor) que abren el circuito. */
export const FALLOS_CIRCUITO_DEFECTO = 5;
/** Tiempo en pausa al abrir el circuito, o mientras las credenciales estén inválidas. */
export const PAUSA_CIRCUITO_MS = 5 * MINUTO;

/** Lease de un envío: si el proceso muere a mitad, la fila se libera sola pasado este tiempo. */
export const LEASE_ENVIO_MS = 5 * MINUTO;

/** Umbrales de los avisos a ADMIN. */
export const UMBRAL_PENDIENTE_MS = 15 * MINUTO;
export const DIAS_BOLETA_SIN_REPORTAR = 3;
export const HORAS_RESUMEN_SIN_RESPUESTA = 24;
/** Días antes del vencimiento del certificado en los que se avisa (se avisa al cruzar el más cercano). */
export const DIAS_AVISO_CERTIFICADO = [60, 30, 7];

/**
 * Códigos SUNAT de credenciales (usuario SOL o clave) inválidas. NO confirmados: en beta la clave incorrecta
 * no devolvió 0102 ni 0109 (se aceptó). Las credenciales rechazadas sí llegan como HTTP 401 (ver enviarSoap).
 */
export const CODIGOS_AUTENTICACION = new Set(['0102', '0109']);

/** Rechazo de validación de SUNAT (2xxx y 3xxx): los datos o el XML no cambian reintentando. */
export function esRechazoPermanente(codigo: string | null | undefined): boolean {
  return !!codigo && /^[23]\d{3}$/.test(codigo);
}

export function esCodigoAutenticacion(codigo: string | null | undefined): boolean {
  return !!codigo && CODIGOS_AUTENTICACION.has(codigo);
}

/**
 * Espera antes del siguiente intento, con jitter de ±10 % para que varios comprobantes no
 * vuelvan a SUNAT todos a la vez. `intentos` es el número de intentos ya hechos (>= 1).
 */
export function esperaFacturacionMs(intentos: number, aleatorio: () => number = Math.random): number {
  const i = Math.max(1, intentos);
  const base = i <= ESPERAS_FACTURACION_MS.length ? ESPERAS_FACTURACION_MS[i - 1] : ESPERA_MAXIMA_FACTURACION_MS;
  const factor = 0.9 + aleatorio() * 0.2;
  return Math.round(base * factor);
}

/** Huecos de una lista de números de comprobante (p. ej. 4, 5, 9 da 6-8). Entrada no ordenada admitida. */
export function huecosDeNumeracion(numeros: number[]): Array<{ desde: number; hasta: number }> {
  const orden = [...new Set(numeros)].sort((a, b) => a - b);
  const huecos: Array<{ desde: number; hasta: number }> = [];
  for (let i = 1; i < orden.length; i++) {
    const anterior = orden[i - 1];
    const actual = orden[i];
    if (actual - anterior > 1) huecos.push({ desde: anterior + 1, hasta: actual - 1 });
  }
  return huecos;
}

/** Umbral más cercano que ya se cruzó (60, 30 o 7 días), o null si el certificado vence después de 60 días. */
export function umbralCertificado(diasRestantes: number): number | null {
  const cruzados = DIAS_AVISO_CERTIFICADO.filter((d) => diasRestantes <= d);
  return cruzados.length ? Math.min(...cruzados) : null;
}
