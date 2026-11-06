/**
 * Fuente única de las reglas de horario de las reservas: la usan la validación al crear,
 * aprobar o editar, las franjas que ven la carta y el bot, y el cruce de mesas.
 *
 * Reglas (hora de Lima, 'HH:mm'):
 * - Una reserva puede empezar desde la apertura hasta `cierra - MARGEN_CIERRE_MIN` (incluido).
 *   Con cierre 22:00 la última reserva empieza 21:00. Es un margen de cierre, no una duración:
 *   la reserva no tiene duración, dura lo que dure el pedido que hagan.
 * - La mesa de una reserva está reservada solo en su ventana [hora, hora + tolerancia]
 *   (ver ventanasSeSolapan en reservas.service). Después, si no llegaron, se libera.
 * - El horario no cruza la medianoche (el admin ya lo rechaza al guardar: abre < cierra).
 */

/** Último inicio de reserva: minutos antes del cierre del local. No es duración de la reserva. */
export const MARGEN_CIERRE_MIN = 60;

/** Paso entre franjas sugeridas. */
export const PASO_FRANJA_MIN = 30;

/** 'HH:mm' a minutos desde las 00:00. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

/** Minutos a 'H:mm' sin cero inicial en la hora, para mensajes («9:00», «21:00»). */
export function horaLegible(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Última hora de inicio permitida (minutos) para un día con apertura y cierre dados,
 * o null si el día no permite reservas (sin horario o cierre demasiado pronto).
 */
export function ultimoInicioReserva(abre: string | null, cierra: string | null): number | null {
  if (!abre || !cierra) return null;
  const ini = aMinutos(abre);
  const fin = aMinutos(cierra);
  if (fin <= ini) return null;
  const ultimo = fin - MARGEN_CIERRE_MIN;
  return ultimo >= ini ? ultimo : null;
}

/** ¿La hora 'HH:mm' puede iniciar una reserva en ese día? */
export function horaEnVentanaReserva(hora: string, abre: string | null, cierra: string | null): boolean {
  const ultimo = ultimoInicioReserva(abre, cierra);
  if (ultimo === null || !abre) return false;
  const m = aMinutos(hora);
  return m >= aMinutos(abre) && m <= ultimo;
}

/** Minutos a 'HH:mm' (con cero inicial), el formato que usa la carta. */
export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Última hora de inicio como 'HH:mm' (o null si el día no permite reservas). */
export function horaUltimoInicio(abre: string | null, cierra: string | null): string | null {
  const ultimo = ultimoInicioReserva(abre, cierra);
  return ultimo === null ? null : horaDeMinutos(ultimo);
}

/** Franjas sugeridas de inicio (cada PASO_FRANJA_MIN), de la apertura al último inicio. */
export function franjasReserva(abre: string | null, cierra: string | null): string[] {
  const ultimo = ultimoInicioReserva(abre, cierra);
  if (ultimo === null || !abre) return [];
  const franjas: string[] = [];
  for (let t = aMinutos(abre); t <= ultimo; t += PASO_FRANJA_MIN) franjas.push(horaDeMinutos(t));
  return franjas;
}

/** Dos ventanas [inicio, fin) en ms se solapan. Un fin igual al inicio de la otra no es solape. */
export function ventanasSeSolapan(iniA: number, finA: number, iniB: number, finB: number): boolean {
  return iniA < finB && iniB < finA;
}
