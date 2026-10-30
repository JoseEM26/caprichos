export interface FechaHoraLima {
  fechaIso: string; // 'YYYY-MM-DD'
  horaMinutos: string; // 'HH:mm'
  diaSemana: number; // 1 (Lunes) .. 7 (Domingo)
}

/**
 * Obtiene la fecha, hora y día de la semana correspondiente a America/Lima (UTC-5).
 */
export function obtenerFechaHoraLima(fecha: Date = new Date()): FechaHoraLima {
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

  const fechaLimaMediodia = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
  const diaJs = fechaLimaMediodia.getUTCDay();
  const diaSemana = diaJs === 0 ? 7 : diaJs;

  return { fechaIso, horaMinutos, diaSemana };
}

/**
 * Obtiene el Date correspondiente al inicio del día de hoy (00:00:00) en America/Lima.
 */
export function obtenerInicioDiaLima(ahora: Date = new Date()): Date {
  const { fechaIso } = obtenerFechaHoraLima(ahora);
  return new Date(`${fechaIso}T00:00:00.000-05:00`);
}

/**
 * Inicio (00:00 Lima) de una fecha YYYY-MM-DD dada en calendario de Lima.
 */
export function inicioDiaLimaDeFecha(fechaIso: string): Date {
  return new Date(`${fechaIso}T00:00:00.000-05:00`);
}

/**
 * Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin zona horaria).
 */
export function sumarDiasFechaIso(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Fecha fija para agotar hasta reactivar (9999-12-31T23:59:59Z).
 */
export const FECHA_HASTA_REACTIVAR = new Date('9999-12-31T23:59:59Z');

/**
 * Calcula el siguiente 00:00 de America/Lima (05:00:00 UTC del día siguiente en Lima).
 * Calculado rigurosamente con la fecha de Lima, no la del servidor.
 */
export function calcularSiguienteMedianocheLima(ahora: Date = new Date()): Date {
  const { fechaIso } = obtenerFechaHoraLima(ahora);
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 5, 0, 0, 0));
}

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

/**
 * Determina el color según los minutos de espera y umbrales de Kevin (DT-69).
 * Verde < 35, Naranja >= 35, Rojo >= 50.
 */
export function calcularColor(minutos: number, naranjaMin = 35, rojoMin = 50): ColorEspera {
  if (minutos >= rojoMin) return 'rojo';
  if (minutos >= naranjaMin) return 'naranja';
  return 'verde';
}

/**
 * Extrae el nombre del combo si la línea pertenece a uno.
 */
export function extraerNombreCombo(linea: any): string | null {
  if (!linea) return null;
  if (linea.combo_nombre) return String(linea.combo_nombre);
  if (linea.combo) return String(linea.combo);
  if (linea.nombre_combo) return String(linea.nombre_combo);

  if (linea.opciones && typeof linea.opciones === 'object' && !Array.isArray(linea.opciones)) {
    if (linea.opciones.combo) return String(linea.opciones.combo);
    if (linea.opciones.combo_nombre) return String(linea.opciones.combo_nombre);
  }

  if (Array.isArray(linea.opciones)) {
    const itemCombo = linea.opciones.find(
      (o: any) =>
        o.combo === true ||
        (typeof o.grupo === 'string' && o.grupo.toUpperCase() === 'COMBO') ||
        o.es_combo === true,
    );
    if (itemCombo) {
      return itemCombo.nombre || itemCombo.opcion_nombre || itemCombo.valor || String(itemCombo);
    }
  }

  if (Array.isArray(linea.opcionesElegidas)) {
    const opCombo = linea.opcionesElegidas.find(
      (o: any) =>
        o.grupo_nombre?.toUpperCase() === 'COMBO' ||
        o.opcion_nombre?.toUpperCase().includes('COMBO'),
    );
    if (opCombo) {
      return opCombo.opcion_nombre || opCombo.grupo_nombre;
    }
  }

  if (typeof linea.nota === 'string') {
    const match = linea.nota.match(/combo:\s*([^\n,]+)/i);
    if (match) return match[1].trim();
  }

  return null;
}

/**
 * Extrae las opciones formateadas para cocina.
 */
export function extraerOpciones(linea: any): Array<{ id?: string; nombre: string; grupo?: string }> {
  if (!linea) return [];

  if (Array.isArray(linea.opcionesElegidas) && linea.opcionesElegidas.length > 0) {
    return linea.opcionesElegidas.map((o: any) => ({
      id: o.opcion_id?.toString() || o.id?.toString(),
      nombre: o.opcion_nombre || o.nombre,
      grupo: o.grupo_nombre || o.grupo,
    }));
  }

  if (Array.isArray(linea.opciones)) {
    return linea.opciones.map((o: any) => ({
      id: o.id?.toString(),
      nombre: o.nombre || o.opcion_nombre,
      grupo: o.grupo || o.grupo_nombre,
    }));
  }

  return [];
}
