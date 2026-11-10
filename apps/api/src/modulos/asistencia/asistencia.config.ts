// Parámetros de asistencia (clave parametro «asistencia.config»). Valores por defecto del dueño:
// radio 10 m, tolerancia 5 min, retención 90 días, tardanza pagada al 50 %.

export interface ConfigAsistencia {
  radioM: number;
  toleranciaMin: number;
  /** Porcentaje del valor hora con que se pagan los minutos de tardanza (ya es el descuento). */
  pagoTardanzaPct: number;
  retencionDias: number;
  /** Marcas a menos de estos minutos de la anterior se unen (doble marca). 0 = no unir. */
  dobleMarcaMin: number;
  /** Hasta cuántos días atrás la persona puede pedir corrección (y se le avisa de inconsistencias). */
  solicitudDiasMax: number;
  precisionMaxM: number;
  localLat: number | null;
  localLng: number | null;
}

export const CONFIG_ASISTENCIA_DEFECTO: ConfigAsistencia = {
  radioM: 10,
  toleranciaMin: 5,
  pagoTardanzaPct: 50,
  retencionDias: 90,
  dobleMarcaMin: 3,
  solicitudDiasMax: 7,
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
    pagoTardanzaPct: numeroEn(v.pagoTardanzaPct, CONFIG_ASISTENCIA_DEFECTO.pagoTardanzaPct, 0, 100),
    retencionDias: numeroEn(v.retencionDias, CONFIG_ASISTENCIA_DEFECTO.retencionDias, 7, 3650),
    dobleMarcaMin: numeroEn(v.dobleMarcaMin, CONFIG_ASISTENCIA_DEFECTO.dobleMarcaMin, 0, 30),
    solicitudDiasMax: numeroEn(v.solicitudDiasMax, CONFIG_ASISTENCIA_DEFECTO.solicitudDiasMax, 1, 31),
    precisionMaxM: numeroEn(v.precisionMaxM, CONFIG_ASISTENCIA_DEFECTO.precisionMaxM, 5, 100),
    localLat: coord(v.localLat, -90, 90),
    localLng: coord(v.localLng, -180, 180),
  };
}
