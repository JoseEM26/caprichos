/** Días de calendario en America/Lima (UTC-5, sin horario de verano) como instantes. */
export const inicioDiaLimaIso = (fecha: string): Date => new Date(`${fecha}T00:00:00.000-05:00`);
export const finDiaLimaIso = (fecha: string): Date => new Date(`${fecha}T23:59:59.999-05:00`);

/** Hoy en Lima como YYYY-MM-DD. */
export const hoyLimaIso = (ahora: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);

/** Suma días a una fecha YYYY-MM-DD (calendario puro). */
export function sumarDiasIso(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
