/** Tamaño de los stickers (mm, tal como se ven en la etiquetera: ancho x alto). Parámetros del sistema editables. */
export const CLAVES_TAMANO_ETIQUETA = {
  BEBIDA_ANCHO: 'impresion_etiqueta_bebida_ancho_mm',
  BEBIDA_ALTO: 'impresion_etiqueta_bebida_alto_mm',
  GENERAL_ANCHO: 'impresion_etiqueta_general_ancho_mm',
  GENERAL_ALTO: 'impresion_etiqueta_general_alto_mm',
} as const;

export interface TamanoMm {
  anchoMm: number;
  altoMm: number;
}

/** Medidas de fábrica (la migración las siembra igual): bebida 76 x 38 mm, general 100 x 100 mm. */
export const TAMANO_BEBIDA_DEFECTO: TamanoMm = { anchoMm: 76, altoMm: 38 };
export const TAMANO_GENERAL_DEFECTO: TamanoMm = { anchoMm: 100, altoMm: 100 };
export const TAMANO_ETIQUETA_MIN_MM = 30;
export const TAMANO_ETIQUETA_MAX_MM = 200;

export interface TamanosEtiqueta {
  bebida: TamanoMm;
  general: TamanoMm;
}

export const TAMANOS_ETIQUETA_DEFECTO: TamanosEtiqueta = { bebida: TAMANO_BEBIDA_DEFECTO, general: TAMANO_GENERAL_DEFECTO };

/** Entero entre 30 y 200 mm. */
export const medidaEtiquetaValida = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= TAMANO_ETIQUETA_MIN_MM && v <= TAMANO_ETIQUETA_MAX_MM;

/** Tamaños desde los valores de `parametro`; lo que falte o no sea válido usa el de fábrica. */
export function tamanosDesdeValores(valores: Record<string, unknown>): TamanosEtiqueta {
  const medida = (clave: string, defecto: number) => (medidaEtiquetaValida(valores[clave]) ? (valores[clave] as number) : defecto);
  const C = CLAVES_TAMANO_ETIQUETA;
  return {
    bebida: {
      anchoMm: medida(C.BEBIDA_ANCHO, TAMANO_BEBIDA_DEFECTO.anchoMm),
      altoMm: medida(C.BEBIDA_ALTO, TAMANO_BEBIDA_DEFECTO.altoMm),
    },
    general: {
      anchoMm: medida(C.GENERAL_ANCHO, TAMANO_GENERAL_DEFECTO.anchoMm),
      altoMm: medida(C.GENERAL_ALTO, TAMANO_GENERAL_DEFECTO.altoMm),
    },
  };
}
