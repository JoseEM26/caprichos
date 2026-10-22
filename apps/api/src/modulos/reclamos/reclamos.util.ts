import { obtenerFechaHoraLima } from '../local/local.util';

/**
 * Obtiene la fecha actual en formato ISO 'YYYY-MM-DD' en la zona horaria America/Lima (UTC-5).
 */
export function obtenerHoyLima(fecha: Date = new Date()): string {
  const { fechaIso } = obtenerFechaHoraLima(fecha);
  return fechaIso;
}

/**
 * Obtiene el año actual correspondiente a la hora de America/Lima.
 */
export function obtenerAnioLima(fecha: Date = new Date()): number {
  const hoyIso = obtenerHoyLima(fecha);
  return parseInt(hoyIso.split('-')[0], 10);
}

/**
 * Formatea un Date a 'YYYY-MM-DD' tomando los componentes UTC para campos @db.Date.
 */
export function formatearFechaIso(fecha: Date | string): string {
  if (typeof fecha === 'string') {
    return fecha.slice(0, 10);
  }
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Suma N días hábiles a una fecha dada en formato 'YYYY-MM-DD'.
 * Sábados y domingos no cuentan como días hábiles.
 * Decisión de la Ola 7: los feriados nacionales o locales quedan fuera de esta ola
 * (se computa el plazo estándar sobre días hábiles lunes a viernes).
 */
export function sumarDiasHabiles(fechaInicioIso: string, diasHabiles: number): string {
  const [y, m, d] = fechaInicioIso.split('-').map(Number);
  let cur = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  let agregados = 0;

  while (agregados < diasHabiles) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const diaSemana = cur.getUTCDay(); // 0 = Domingo, 6 = Sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      agregados++;
    }
  }

  const year = cur.getUTCFullYear();
  const month = String(cur.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cur.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula la cantidad de días hábiles restantes entre hoy (hora de Lima) y la fecha límite.
 * - Si hoy es anterior a la fecha límite: devuelve un entero positivo (N > 0).
 * - Si hoy es el mismo día de la fecha límite: devuelve 0.
 * - Si hoy es posterior a la fecha límite: devuelve un entero negativo (-N).
 */
export function calcularDiasHabilesRestantes(
  fechaHoyIso: string,
  fechaLimiteIso: string,
): number {
  if (fechaHoyIso === fechaLimiteIso) {
    return 0;
  }

  const [y1, m1, d1] = fechaHoyIso.split('-').map(Number);
  const [y2, m2, d2] = fechaLimiteIso.split('-').map(Number);

  const tHoy = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const tLim = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);

  if (tHoy < tLim) {
    let cur = new Date(tHoy);
    let habiles = 0;
    while (cur.getTime() < tLim) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      const diaSemana = cur.getUTCDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        habiles++;
      }
    }
    return habiles;
  } else {
    let cur = new Date(tLim);
    let habiles = 0;
    while (cur.getTime() < tHoy) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      const diaSemana = cur.getUTCDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        habiles++;
      }
    }
    return -habiles;
  }
}

/**
 * Genera el texto descriptivo del plazo legal: «Faltan N días» o «Vencido hace N días».
 */
export function formatearTextoPlazo(diasHabilesRestantes: number): string {
  if (diasHabilesRestantes > 1) {
    return `Faltan ${diasHabilesRestantes} días`;
  }
  if (diasHabilesRestantes === 1) {
    return 'Falta 1 día';
  }
  if (diasHabilesRestantes === 0) {
    return 'Faltan 0 días';
  }
  const diasVencidos = Math.abs(diasHabilesRestantes);
  return diasVencidos === 1
    ? 'Vencido hace 1 día'
    : `Vencido hace ${diasVencidos} días`;
}

/**
 * Enmascara un documento oficial (DNI o Carnet de Extranjería) según la Ley 29733 (ADR-005).
 * Muestra los 2 primeros y 2 últimos caracteres (ej. '12****78').
 */
export function enmascararDocumento(doc: string): string {
  if (!doc || typeof doc !== 'string') {
    return '****';
  }
  const limpio = doc.trim();
  if (limpio.length < 4) {
    return '****';
  }
  return `${limpio.slice(0, 2)}****${limpio.slice(-2)}`;
}

/**
 * Enmascara un teléfono de 9 dígitos según la Ley 29733 (ADR-005).
 * Muestra los 2 primeros y 2 últimos dígitos (ej. '98*****21').
 */
export function enmascararTelefono(tel: string): string {
  if (!tel || typeof tel !== 'string') {
    return '****';
  }
  const limpio = tel.trim();
  if (limpio.length < 4) {
    return '****';
  }
  return `${limpio.slice(0, 2)}*****${limpio.slice(-2)}`;
}
