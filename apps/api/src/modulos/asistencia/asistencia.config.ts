// Parámetros de asistencia (clave parametro «asistencia.config»). Valores por defecto del dueño:
// radio 10 m, tolerancia 5 min, retención 90 días, penalidad por tardanza 100 % (el tiempo tarde no se paga y además se descuenta su valor).

export interface ConfigAsistencia {
  radioM: number;
  toleranciaMin: number;
  /** Penalidad por tardanza: % del valor del tiempo no pagado (0–500; 100 = lo mismo; 0 = sin penalidad). */
  tardanzaPenalidadPct: number;
  retencionDias: number;
  /** Multiplicador de la hora extra aprobada (defecto 1.25). */
  multiplicadorExtra: number;
  /** Descuento semanal de Netflix por defecto (S/). */
  netflixSemanal: number;
  /** Valor hora DIAS_HORAS por defecto: días del mes y horas por día (editables por persona). */
  diasMesDefecto: number;
  horasDiaDefecto: number;
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
  tardanzaPenalidadPct: 100,
  retencionDias: 90,
  multiplicadorExtra: 1.25,
  netflixSemanal: 1.64,
  diasMesDefecto: 24,
  horasDiaDefecto: 9,
  dobleMarcaMin: 3,
  solicitudDiasMax: 7,
  precisionMaxM: 25,
  localLat: null,
  localLng: null,
};

export const CLAVE_CONFIG_ASISTENCIA = 'asistencia.config';

/** Reemplazos y cambios de turno: hasta cuántos días adelante se puede pedir y cuántos pedidos por persona al día. */
export const TURNOS_DIAS_ADELANTO_MAX = 30;
export const TURNOS_MAX_PEDIDOS_DIA = 10;

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
    tardanzaPenalidadPct: numeroEn(v.tardanzaPenalidadPct, CONFIG_ASISTENCIA_DEFECTO.tardanzaPenalidadPct, 0, 500),
    multiplicadorExtra: numeroEn(v.multiplicadorExtra, CONFIG_ASISTENCIA_DEFECTO.multiplicadorExtra, 1, 5),
    netflixSemanal: numeroEn(v.netflixSemanal, CONFIG_ASISTENCIA_DEFECTO.netflixSemanal, 0, 1000),
    diasMesDefecto: numeroEn(v.diasMesDefecto, CONFIG_ASISTENCIA_DEFECTO.diasMesDefecto, 1, 31),
    horasDiaDefecto: numeroEn(v.horasDiaDefecto, CONFIG_ASISTENCIA_DEFECTO.horasDiaDefecto, 1, 24),
    retencionDias: numeroEn(v.retencionDias, CONFIG_ASISTENCIA_DEFECTO.retencionDias, 7, 3650),
    dobleMarcaMin: numeroEn(v.dobleMarcaMin, CONFIG_ASISTENCIA_DEFECTO.dobleMarcaMin, 0, 30),
    solicitudDiasMax: numeroEn(v.solicitudDiasMax, CONFIG_ASISTENCIA_DEFECTO.solicitudDiasMax, 1, 31),
    precisionMaxM: numeroEn(v.precisionMaxM, CONFIG_ASISTENCIA_DEFECTO.precisionMaxM, 5, 100),
    localLat: coord(v.localLat, -90, 90),
    localLng: coord(v.localLng, -180, 180),
  };
}
