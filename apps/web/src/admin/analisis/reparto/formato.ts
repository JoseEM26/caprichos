/** Formatos compartidos de las pestañas Reparto, Equipo y Almacén. Todo en hora de Lima. */
export const soles = (n: number | null | undefined): string => (n == null ? 'Sin dato' : `S/ ${n.toFixed(2)}`);

/** Instante ISO a «dd/mm hh:mm» en hora de Lima (UTC-5, sin horario de verano). */
export function fechaHoraLima(iso: string | null | undefined): string {
  if (!iso) return 'Sin dato';
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  if (Number.isNaN(d.getTime())) return 'Sin dato';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Fecha ISO «AAAA-MM-DD» a «dd/mm». */
export const diaMes = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const num = (n: number | null | undefined, decimales = 1): string =>
  n == null ? 'Sin dato' : (Math.round(n * 10 ** decimales) / 10 ** decimales).toString().replace('.', ',');
