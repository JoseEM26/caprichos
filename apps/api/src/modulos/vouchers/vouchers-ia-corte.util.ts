/** Error HTTP de OpenAI con su estado y cuerpo, para clasificarlo sin depender del texto del mensaje. */
export class ErrorOpenAI extends Error {
  constructor(
    readonly status: number,
    readonly cuerpo: string,
  ) {
    super(`OpenAI Vision error [${status}]: ${cuerpo}`);
    this.name = 'ErrorOpenAI';
  }
}

/**
 * SALDO y CLAVE cuentan para el corte (3 seguidos). ERROR (5xx, timeout, red) cuenta menos (5 seguidos).
 * NO_CUENTA (p. ej. 429 de límite por minuto) no abre el corte ni lo cierra.
 */
export type FalloIa = 'SALDO' | 'CLAVE' | 'ERROR' | 'NO_CUENTA';

const PATRON_SIN_SALDO = /insufficient_quota|billing|exceeded your current quota/i;

export function clasificarFalloOpenAI(status: number, cuerpo: string): FalloIa {
  const sinSaldo = PATRON_SIN_SALDO.test(cuerpo || '');
  if (status === 402 || (status === 429 && sinSaldo)) return 'SALDO';
  if (status === 401 || status === 403) return sinSaldo ? 'SALDO' : 'CLAVE';
  if (status === 408 || status >= 500) return 'ERROR';
  return 'NO_CUENTA';
}

/** Clasifica cualquier excepción de la llamada: HTTP por estado; red o timeout cuentan como ERROR. */
export function clasificarExcepcionIa(err: unknown): FalloIa {
  if (err instanceof ErrorOpenAI) return clasificarFalloOpenAI(err.status, err.cuerpo);
  // Respuesta de OpenAI que no es JSON válido: no es caída del servicio
  if (err instanceof SyntaxError) return 'NO_CUENTA';
  return 'ERROR';
}
