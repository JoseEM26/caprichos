/** Slots fijos de «Fotos del local»: el orden de esta lista es el orden de la galería. */
export const SLOTS_FOTOS_LOCAL = [
  'Fachada',
  'Salón principal',
  'Barra y vitrina',
  'Terraza',
  'Equipo y cocina',
  'Ambiente de noche',
] as const;

export const DIAS_SEMANA_NOMBRES: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/**
 * Obtiene la fecha, hora y día de la semana (1 = Lunes .. 7 = Domingo)
 * correspondiente a la zona horaria 'America/Lima'.
 */
export function obtenerFechaHoraLima(fecha: Date = new Date()): {
  fechaIso: string; // 'YYYY-MM-DD'
  horaMinutos: string; // 'HH:mm'
  diaSemana: number; // 1 (Lunes) .. 7 (Domingo)
} {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partes = formateador.formatToParts(fecha);
  const getPart = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const fechaIso = `${year}-${month}-${day}`;
  const horaMinutos = `${hour}:${minute}`;

  // Determinamos el día de la semana en Lima fijando la fecha en UTC al mediodía
  const fechaLimaMediodia = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
  const diaJs = fechaLimaMediodia.getUTCDay(); // 0 = Domingo, 1 = Lunes .. 6 = Sábado
  const diaSemana = diaJs === 0 ? 7 : diaJs;

  return { fechaIso, horaMinutos, diaSemana };
}

/**
 * Normaliza un campo de hora (Date de Prisma @db.Time o string) a formato 'HH:mm'.
 */
export function formatearHora(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;

  if (typeof valor === 'string') {
    const match = valor.match(/^(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    const d = new Date(valor);
    if (!isNaN(d.getTime())) {
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    return valor;
  }

  if (valor instanceof Date) {
    // Prisma almacena TIME en UTC anclado a 1970-01-01
    const h = String(valor.getUTCHours()).padStart(2, '0');
    const m = String(valor.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  return null;
}

/**
 * Convierte un string 'HH:mm' a Date anclado a 1970-01-01 UTC para Prisma @db.Time.
 */
export function horaToDate(hora: string): Date {
  const [h, m] = hora.split(':');
  return new Date(`1970-01-01T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00.000Z`);
}
