export const TIPOS_VALIDOS_PLANO = [
  'MESA',
  'COCINA',
  'BARRA',
  'BANO',
  'PARED',
  'ENTRADA',
  'OTRO',
  'ESCALERA',
  'CAJA',
] as const;

export type TipoPlano = (typeof TIPOS_VALIDOS_PLANO)[number];

/**
 * Normaliza nombres comunes de tipos hacia el enum permitido por la base de datos.
 */
export function normalizarTipoPlano(tipo: string): string {
  const t = (tipo || '').trim().toUpperCase();
  if (t === 'BAÑO' || t === 'BAÑOS' || t === 'BANOS') {
    return 'BANO';
  }
  return t;
}

/**
 * Valida si un tipo es admitido en el plano.
 */
export function esTipoValido(tipo: string): boolean {
  const norm = normalizarTipoPlano(tipo);
  return (TIPOS_VALIDOS_PLANO as readonly string[]).includes(norm);
}

export interface Rectangulo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Determina si dos rectángulos se superponen en una cuadrícula.
 * Dos rectángulos que solo comparten borde o esquina NO se consideran superpuestos.
 */
export function verificarSuperposicion(a: Rectangulo, b: Rectangulo): boolean {
  const separadoHorizontal = a.x + a.ancho <= b.x || b.x + b.ancho <= a.x;
  const separadoVertical = a.y + a.alto <= b.y || b.y + b.alto <= a.y;
  return !(separadoHorizontal || separadoVertical);
}

/**
 * Verifica si un elemento cabe completamente dentro de los límites de la cuadrícula.
 */
export function verificarDentroDeCuadricula(
  elem: Rectangulo,
  cuadricula: { ancho: number; alto: number },
): boolean {
  return (
    elem.x >= 0 &&
    elem.y >= 0 &&
    elem.ancho > 0 &&
    elem.alto > 0 &&
    elem.x + elem.ancho <= cuadricula.ancho &&
    elem.y + elem.alto <= cuadricula.alto
  );
}

/**
 * Rango horario del día actual en America/Lima (inicio 00:00:00.000-05:00 hasta 23:59:59.999-05:00).
 */
export function obtenerRangoHoyLima(ahora: Date = new Date()): { inicio: Date; fin: Date } {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const fechaIso = formateador.format(ahora); // 'YYYY-MM-DD'
  const inicio = new Date(`${fechaIso}T00:00:00.000-05:00`);
  const fin = new Date(`${fechaIso}T23:59:59.999-05:00`);
  return { inicio, fin };
}
