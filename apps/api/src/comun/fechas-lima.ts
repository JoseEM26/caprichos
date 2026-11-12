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

/** Hora entera (0 a 23) en Lima de un instante. */
export const horaLimaEntera = (d: Date): number =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: 'numeric', hourCycle: 'h23' }).format(d));

/** Día calendario de Lima (AAAA-MM-DD) de un instante. */
export const diaCalendarioLima = (d: Date = new Date()): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

/** ¿Hoy (AAAA-MM-DD, día de Lima) es el cumpleaños dia/mes? El 29/02 se celebra el 28/02 en años no bisiestos. */
export function esCumpleanosHoy(dia: number | null | undefined, mes: number | null | undefined, hoy: string): boolean {
  if (!dia || !mes) return false;
  const [y, m, d] = hoy.split('-').map(Number);
  const bisiesto = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const diaCelebra = mes === 2 && dia === 29 && !bisiesto ? 28 : dia;
  return m === mes && d === diaCelebra;
}
