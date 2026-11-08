import { TAMANO_ETIQUETA_MAX_MM, TAMANO_ETIQUETA_MIN_MM, type TamanoMm } from './tamanosEtiqueta.js';

export type OrientacionEtiqueta = 'apaisado' | 'vertical';

/** Tamaño de un sticker en UNA computadora: reemplaza al general del local solo allí. */
export interface TamanoEtiquetaPc extends TamanoMm {
  orientacion?: OrientacionEtiqueta;
  /** Margen extra al borde, en mm (0 a 10). */
  margenMm?: number;
}

/** Medidas comunes de rollo para elegir con un toque (ancho x alto en mm). */
export const PRESETS_TAMANO_ETIQUETA: ReadonlyArray<{ id: string; nombre: string; anchoMm: number; altoMm: number }> = [
  { id: '76x38', nombre: '76 × 38', anchoMm: 76, altoMm: 38 },
  { id: '100x100', nombre: '100 × 100', anchoMm: 100, altoMm: 100 },
  { id: '101.6x63.5', nombre: '101,6 × 63,5', anchoMm: 101.6, altoMm: 63.5 },
  { id: '60x40', nombre: '60 × 40', anchoMm: 60, altoMm: 40 },
  { id: '50x30', nombre: '50 × 30', anchoMm: 50, altoMm: 30 },
];

export const MARGEN_ETIQUETA_MAX_MM = 10;

/** Medida válida de una PC: 30 a 200 mm (admite décimas, como 101,6 × 63,5). */
const medidaPc = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= TAMANO_ETIQUETA_MIN_MM && v <= TAMANO_ETIQUETA_MAX_MM;

/** Tamaño por PC válido, o null (sin valor propio: hereda el general del local). */
export function tamanoPcValido(v: unknown): TamanoEtiquetaPc | null {
  const t = (v ?? null) as Record<string, unknown> | null;
  if (!t || !medidaPc(t.anchoMm) || !medidaPc(t.altoMm)) return null;
  const r: TamanoEtiquetaPc = { anchoMm: t.anchoMm, altoMm: t.altoMm };
  if (t.orientacion === 'apaisado' || t.orientacion === 'vertical') r.orientacion = t.orientacion;
  if (typeof t.margenMm === 'number' && t.margenMm >= 0 && t.margenMm <= MARGEN_ETIQUETA_MAX_MM) r.margenMm = t.margenMm;
  return r;
}

/** Aplica la orientación elegida: apaisado deja el lado largo como ancho; vertical, como alto. */
export function aplicarOrientacion(t: TamanoEtiquetaPc): TamanoEtiquetaPc {
  const largo = Math.max(t.anchoMm, t.altoMm);
  const corto = Math.min(t.anchoMm, t.altoMm);
  if (t.orientacion === 'apaisado') return { ...t, anchoMm: largo, altoMm: corto };
  if (t.orientacion === 'vertical') return { ...t, anchoMm: corto, altoMm: largo };
  return t;
}

/** Tamaño que sale en esa PC: el propio (con orientación y margen) o, si no tiene, el general del local. */
export function tamanoEfectivo(propio: unknown, general: TamanoMm): TamanoEtiquetaPc {
  const p = tamanoPcValido(propio);
  return p ? aplicarOrientacion(p) : general;
}
