/** Fechas de Lima para los filtros de Análisis (el servidor cuenta los días igual: UTC-5, sin horario de verano). */
export type PresetFecha = 'hoy' | 'ayer' | '7d' | '30d' | 'rango';

export const PRESETS_FECHA: ReadonlyArray<{ id: PresetFecha; nombre: string }> = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: '7d', nombre: '7 días' },
  { id: '30d', nombre: '30 días' },
  { id: 'rango', nombre: 'Elegir fechas' },
];

/** Máximo de días que acepta el servidor. */
export const MAX_DIAS = 92;

export const hoyLima = (ahora: Date = new Date()): string => new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

export const sumarDias = (iso: string, dias: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
};

export const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

/** Rango de un preset. Con «rango» usa lo que escribió la persona. */
export function rangoDePreset(preset: PresetFecha, hoy: string, desde = '', hasta = ''): { desde: string; hasta: string } {
  switch (preset) {
    case 'ayer':
      return { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'rango':
      return { desde: desde || hoy, hasta: hasta || desde || hoy };
    default:
      return { desde: hoy, hasta: hoy };
  }
}

/** Error legible del rango (vacío si está bien). */
export function errorDeRango(desde: string, hasta: string, hoy: string): string {
  if (desde > hasta) return 'La fecha inicial no puede ser después de la final.';
  if (hasta > hoy) return 'No se puede mirar el futuro.';
  if (diasEntre(desde, hasta) > MAX_DIAS) return `Elige como máximo ${MAX_DIAS} días.`;
  return '';
}

export const ddmm = (iso: string): string => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/** Minutos a texto corto: «45 s», «7,5 min», «2 h 10 min». */
export function textoMinutos(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return 'Sin dato';
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 60) return `${(Math.round(min * 10) / 10).toString().replace('.', ',')} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
