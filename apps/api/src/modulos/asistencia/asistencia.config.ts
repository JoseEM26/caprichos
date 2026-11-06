// Parámetros de asistencia (clave parametro «asistencia.config»). Valores por defecto del dueño:
// radio 10 m, tolerancia 10 min, retención 90 días.

export interface ConfigAsistencia {
  radioM: number;
  toleranciaMin: number;
  retencionDias: number;
  precisionMaxM: number;
  localLat: number | null;
  localLng: number | null;
}

export const CONFIG_ASISTENCIA_DEFECTO: ConfigAsistencia = {
  radioM: 10,
  toleranciaMin: 10,
  retencionDias: 90,
  precisionMaxM: 25,
  localLat: null,
  localLng: null,
};

export const CLAVE_CONFIG_ASISTENCIA = 'asistencia.config';

const numeroEn = (v: unknown, def: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, n));
};

/** Lee el valor guardado y lo deja dentro de rangos seguros; lo que falte toma el valor por defecto. */
export function leerConfigAsistencia(valor: unknown): ConfigAsistencia {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>;
  const coord = (x: unknown, min: number, max: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : null;
  return {
    radioM: numeroEn(v.radioM, CONFIG_ASISTENCIA_DEFECTO.radioM, 3, 100),
    toleranciaMin: numeroEn(v.toleranciaMin, CONFIG_ASISTENCIA_DEFECTO.toleranciaMin, 0, 60),
    retencionDias: numeroEn(v.retencionDias, CONFIG_ASISTENCIA_DEFECTO.retencionDias, 7, 3650),
    precisionMaxM: numeroEn(v.precisionMaxM, CONFIG_ASISTENCIA_DEFECTO.precisionMaxM, 5, 100),
    localLat: coord(v.localLat, -90, 90),
    localLng: coord(v.localLng, -180, 180),
  };
}
