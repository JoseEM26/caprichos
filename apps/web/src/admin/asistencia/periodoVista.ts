/** Períodos de la lista de planilla: semana (lunes a domingo) o mes calendario. Fechas AAAA-MM-DD, sin zona horaria. */
export type ModoPeriodo = 'SEMANA' | 'MES';
/** Lo que se ve en la lista: semana, mes o un rango libre «desde / hasta». */
export type ModoVista = ModoPeriodo | 'RANGO';

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

export const MAX_DIAS_RANGO = 93;
export const diasEntre = (desde: string, hasta: string) => Math.round((aMs(hasta) - aMs(desde)) / 86_400_000) + 1;

/** Quincena (1–15 o 16–fin de mes) que contiene la fecha. */
export function quincenaDe(f: string): { desde: string; hasta: string } {
  const mes = f.slice(0, 7);
  return +f.slice(8, 10) <= 15 ? { desde: `${mes}-01`, hasta: `${mes}-15` } : { desde: `${mes}-16`, hasta: rangoDe('MES', f).hasta };
}

export interface PresetRango { id: string; etiqueta: string; desde: string; hasta: string }
/** Atajos del rango libre, a partir de «hoy». */
export function presetsRango(hoy: string): PresetRango[] {
  const q = quincenaDe(hoy);
  return [
    { id: 'semana', etiqueta: 'Esta semana', ...rangoDe('SEMANA', hoy) },
    { id: 'semana-pasada', etiqueta: 'Semana pasada', ...rangoDe('SEMANA', moverPeriodo('SEMANA', hoy, -1)) },
    { id: 'mes', etiqueta: 'Este mes', ...rangoDe('MES', hoy) },
    { id: 'mes-pasado', etiqueta: 'Mes pasado', ...rangoDe('MES', moverPeriodo('MES', hoy, -1)) },
    { id: 'quincena', etiqueta: 'Quincena actual', ...q },
    { id: 'quincena-pasada', etiqueta: 'Quincena pasada', ...quincenaDe(sumarDiasIso(q.desde, -1)) },
  ];
}

/** Mensaje si el rango no sirve (null = válido). */
export function errorRango(desde: string, hasta: string): string | null {
  if (hasta < desde) return 'La fecha «hasta» no puede ser anterior a «desde».';
  if (diasEntre(desde, hasta) > MAX_DIAS_RANGO) return `El rango no puede pasar de ${MAX_DIAS_RANGO} días.`;
  return null;
}

/** «Del 1 al 15 de noviembre de 2026» · «Del 28 de octubre al 3 de noviembre de 2026». */
export function etiquetaRango(desde: string, hasta: string): string {
  const mD = MESES[+desde.slice(5, 7) - 1];
  const mH = MESES[+hasta.slice(5, 7) - 1];
  if (desde === hasta) return `${dia(desde)} de ${mD} de ${desde.slice(0, 4)}`;
  const cola = `${dia(hasta)} de ${mH} de ${hasta.slice(0, 4)}`;
  return desde.slice(0, 7) === hasta.slice(0, 7) ? `Del ${dia(desde)} al ${cola}` : `Del ${dia(desde)} de ${mD}${desde.slice(0, 4) === hasta.slice(0, 4) ? '' : ` de ${desde.slice(0, 4)}`} al ${cola}`;
}
