const ZONA_LIMA = 'America/Lima';

/** Fecha (YYYY-MM-DD) y hora (HH:mm) en Lima de un instante ISO. Vacío si no es válido. */
export function partesLima(iso: string | null | undefined): { fecha: string; hora: string } {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return { fecha: '', hora: '' };
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_LIMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(t));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';
  return { fecha: `${p('year')}-${p('month')}-${p('day')}`, hora: `${p('hour')}:${p('minute')}` };
}

/** Instante ISO con la zona de Lima (Perú no tiene horario de verano). */
export function isoLima(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-05:00`;
}

/** Fecha de hoy en Lima (YYYY-MM-DD). */
export function hoyLima(ahora: Date = new Date()): string {
  return partesLima(ahora.toISOString()).fecha;
}
