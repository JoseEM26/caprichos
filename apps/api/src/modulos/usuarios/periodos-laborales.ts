/**
 * Historial laboral: cada periodo trabajado es una fila de party_role con rol TRABAJADOR
 * (desde = ingreso, hasta = salida; hasta null = sigue). Funciones puras, sin Prisma.
 * Los días son inclusivos: dos periodos no pueden compartir ningún día.
 */

export interface Periodo {
  id?: string;
  desde: Date;
  hasta: Date | null;
}

export interface Duracion {
  anios: number;
  meses: number;
  dias: number;
}

/** AAAA-MM-DD a fecha de día (UTC medianoche). null si el formato o la fecha no existen. */
export function fechaDia(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto) return null;
  return d;
}

export const aTexto = (d: Date): string => d.toISOString().slice(0, 10);

/** Hoy en Lima (UTC-5), como fecha de día. */
export function hoyLima(ahora: Date = new Date()): Date {
  return fechaDia(new Date(ahora.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)) as Date;
}

/** Día anterior a una fecha de día. */
export function diaAnterior(d: Date): Date {
  return new Date(d.getTime() - 86400000);
}

/** ¿Se solapan dos periodos (días inclusivos)? hasta null = abierto. */
export function seSolapan(a: Periodo, b: Periodo): boolean {
  const aHasta = a.hasta ? a.hasta.getTime() : Infinity;
  const bHasta = b.hasta ? b.hasta.getTime() : Infinity;
  return a.desde.getTime() <= bHasta && b.desde.getTime() <= aHasta;
}

/** Error de un periodo frente a los demás de la misma persona, o null si es válido. */
export function errorPeriodo(nuevo: Periodo, otros: Periodo[]): string | null {
  if (nuevo.hasta && nuevo.hasta.getTime() < nuevo.desde.getTime()) {
    return 'La fecha de salida no puede ser anterior a la de ingreso.';
  }
  if (otros.some((o) => seSolapan(nuevo, o))) {
    return 'Las fechas se cruzan con otro periodo trabajado de esta persona.';
  }
  return null;
}

/** Suma meses a una fecha de día, recortando al último día del mes si hace falta (31 ene + 1 mes = 28/29 feb). */
function sumarMeses(d: Date, meses: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + meses;
  const ultimoDia = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), ultimoDia)));
}

/** Duración calendario entre dos fechas (años, meses y días). */
export function duracion(desde: Date, hasta: Date): Duracion {
  let meses = (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (hasta.getUTCMonth() - desde.getUTCMonth());
  if (hasta.getUTCDate() < desde.getUTCDate()) meses--;
  if (meses < 0) meses = 0;
  const ancla = sumarMeses(desde, meses);
  const dias = Math.max(0, Math.round((hasta.getTime() - ancla.getTime()) / 86400000));
  return { anios: Math.floor(meses / 12), meses: meses % 12, dias };
}

/** «1 año 4 meses» si llega a un año; si no, «8 meses 13 días». */
export function formatoDuracion(d: Duracion): string {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  if (d.anios >= 1) {
    return d.meses ? `${plural(d.anios, 'año', 'años')} ${plural(d.meses, 'mes', 'meses')}` : plural(d.anios, 'año', 'años');
  }
  return `${plural(d.meses, 'mes', 'meses')} ${plural(d.dias, 'día', 'días')}`;
}

/** Tiempo total: suma de días de todos los periodos (abiertos cuentan hasta hoy), en años y meses. */
export function tiempoTotal(periodos: Periodo[], hoy: Date): { anios: number; meses: number; dias: number; totalDias: number } {
  const totalDias = periodos.reduce((suma, p) => {
    const fin = p.hasta ?? hoy;
    return suma + Math.max(0, Math.round((fin.getTime() - p.desde.getTime()) / 86400000));
  }, 0);
  return { anios: Math.floor(totalDias / 365), meses: Math.floor((totalDias % 365) / 30), dias: totalDias % 30, totalDias };
}

/** Veces que salió: periodos cerrados (cada uno termina con una salida). */
export function vecesQueSalio(periodos: Periodo[]): number {
  return periodos.filter((p) => p.hasta !== null).length;
}

/** «2 años 3 meses» o «3 meses» (sin días): así se muestra el tiempo total. */
export function formatoTotal(t: { anios: number; meses: number }): string {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  if (t.anios >= 1) return `${plural(t.anios, 'año', 'años')} ${plural(t.meses, 'mes', 'meses')}`;
  return plural(t.meses, 'mes', 'meses');
}
