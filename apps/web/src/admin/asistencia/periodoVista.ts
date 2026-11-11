/** Períodos de la lista de planilla: semana (lunes a domingo) o mes calendario. Fechas AAAA-MM-DD, sin zona horaria. */
export type ModoPeriodo = 'SEMANA' | 'MES';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const aMs = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const sumarDiasIso = (f: string, n: number) => aIso(aMs(f) + n * 86_400_000);
/** Primer día del mes de `f` movido `n` meses. */
export const sumarMesesIso = (f: string, n: number) => aIso(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1 + n, 1));

export function rangoDe(modo: ModoPeriodo, f: string): { desde: string; hasta: string } {
  if (modo === 'SEMANA') {
    const atras = (new Date(aMs(f)).getUTCDay() + 6) % 7; // lunes = 0
    const desde = sumarDiasIso(f, -atras);
    return { desde, hasta: sumarDiasIso(desde, 6) };
  }
  const desde = `${f.slice(0, 7)}-01`;
  return { desde, hasta: sumarDiasIso(sumarMesesIso(f, 1), -1) };
}

/** Avanza o retrocede un período entero. */
export const moverPeriodo = (modo: ModoPeriodo, f: string, n: number) => (modo === 'SEMANA' ? sumarDiasIso(f, 7 * n) : sumarMesesIso(f, n));

const dia = (f: string) => String(+f.slice(8, 10));
/** «Semana del 9 al 15 de noviembre de 2026» · «Noviembre 2026». */
export function etiquetaPeriodo(modo: ModoPeriodo, f: string): string {
  const { desde, hasta } = rangoDe(modo, f);
  const mD = MESES[+desde.slice(5, 7) - 1];
  const mH = MESES[+hasta.slice(5, 7) - 1];
  if (modo === 'MES') return `${mD[0].toUpperCase()}${mD.slice(1)} ${desde.slice(0, 4)}`;
  const anio = hasta.slice(0, 4);
  return desde.slice(0, 7) === hasta.slice(0, 7)
    ? `Semana del ${dia(desde)} al ${dia(hasta)} de ${mH} de ${anio}`
    : `Semana del ${dia(desde)} de ${mD} al ${dia(hasta)} de ${mH} de ${anio}`;
}
