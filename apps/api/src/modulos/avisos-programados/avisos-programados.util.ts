/** Utilidades puras de los avisos programados por correo (sin base de datos: se prueban con fechas inyectadas). */

export const aMinutosLima = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Instante (UTC) en que empieza el día de Lima de la fecha AAAA-MM-DD (Lima no tiene horario de verano). */
export const inicioDiaLima = (fechaIso: string): Date => new Date(`${fechaIso}T00:00:00.000-05:00`);

/** «08:12» en hora de Lima. */
export const horaLima = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

export const minutosEntre = (desde: Date, hasta: Date): number => Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 60_000));

/** Recorta a `max` caracteres en una sola línea, sin saltos ni espacios repetidos. */
export function recortar(texto: string, max: number): string {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
}

/** Entero dentro de [min, max]; si el parámetro falta o está fuera de rango, el defecto. */
export function enteroEnRango(valor: unknown, defecto: number, min: number, max: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : defecto;
}

/** Los interruptores se guardan como 'si' / 'no' (o boolean); encendido por defecto. */
export function interruptorEncendido(valor: unknown): boolean {
  if (valor === false) return false;
  return !(typeof valor === 'string' && valor.trim().toLowerCase() === 'no');
}
