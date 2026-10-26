export const DIMENSIONES_ETIQUETA = {
  ANCHO_MM: 63.5,
  ALTO_MM: 101.6,
  DPI: 203,
  DOTS_POR_MM: 8,
  ANCHO_DOTS: 508,
  ALTO_DOTS: 812,
  GAP_MM: 3,
  GAP_OFFSET_MM: 0,
} as const;

export const TIPOS_ETIQUETA = {
  GENERAL: 'ETIQUETA_GENERAL',
  AREA: 'ETIQUETA_AREA',
  BEBIDA: 'ETIQUETA_BEBIDA',
} as const;

export const ESTADOS_PRINT_JOB = {
  PENDIENTE: 'PENDIENTE',
  IMPRIMIENDO: 'IMPRIMIENDO',
  IMPRESO: 'IMPRESO',
  FALLIDO: 'FALLIDO',
} as const;

export const ESTADOS_IMPRESORA = {
  LISTA: 'lista',
  SIN_PAPEL: 'sin_papel',
  DESCONECTADA: 'desconectada',
  ERROR: 'error',
} as const;
