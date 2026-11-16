/** «hace 10 min», «hace 1 h 5 min». */
export function haceTexto(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}
