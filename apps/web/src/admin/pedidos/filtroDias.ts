/** Filtro de días de la lista de Pedidos y caja. Todas las fechas son YYYY-MM-DD del calendario de Lima. */

export const MAX_DIAS_RANGO = 31;

export type ModoDias = 'hoy' | 'ayer' | 'semana' | 'rango' | 'pendientes';

export interface RangoPedidos {
  modo: ModoDias;
  desde: string;
  hasta: string;
}

/** Día calendario actual en Lima (YYYY-MM-DD). */
export function hoyLima(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

/** Suma días a una fecha YYYY-MM-DD con aritmética de calendario (sin zona horaria). */
export function sumarDias(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function rangoHoy(hoy: string = hoyLima()): RangoPedidos {
  return { modo: 'hoy', desde: hoy, hasta: hoy };
}

export function rangoPara(modo: Exclude<ModoDias, 'rango' | 'pendientes'>, hoy: string = hoyLima()): RangoPedidos {
  if (modo === 'ayer') {
    const ayer = sumarDias(hoy, -1);
    return { modo, desde: ayer, hasta: ayer };
  }
  if (modo === 'semana') {
    return { modo, desde: sumarDias(hoy, -6), hasta: hoy };
  }
  return rangoHoy(hoy);
}

/** Parámetros de GET /admin/pedidos para el rango elegido. */
export function parametrosDeRango(r: RangoPedidos): { desde?: string; hasta?: string; pendientes?: boolean } {
  if (r.modo === 'pendientes') return { pendientes: true };
  return { desde: r.desde, hasta: r.hasta };
}

/** Error de validación del rango personalizado, o null si es válido. */
export function errorRangoPersonalizado(desde: string, hasta: string, hoy: string = hoyLima()): string | null {
  if (!desde || !hasta) return 'Elige la fecha de inicio y la de fin.';
  if (desde > hasta) return 'La fecha de inicio no puede ser posterior a la de fin.';
  if (hasta > hoy) return 'La fecha de fin no puede ser posterior a hoy.';
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1;
  if (dias > MAX_DIAS_RANGO) return `El rango no puede pasar de ${MAX_DIAS_RANGO} días.`;
  return null;
}

/** Fecha YYYY-MM-DD como «29 oct» (en Lima). */
export function fechaCorta(fechaIso: string): string {
  return new Date(`${fechaIso}T12:00:00-05:00`)
    .toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })
    .replace('.', '');
}

/** Texto del rango activo: «hoy, 29 oct», «ayer, 28 oct», «22 oct – 28 oct», «pendientes de días anteriores». */
export function textoRango(r: RangoPedidos, hoy: string = hoyLima()): string {
  if (r.modo === 'pendientes') return 'pendientes de días anteriores';
  if (r.modo === 'hoy') return `hoy, ${fechaCorta(hoy)}`;
  if (r.modo === 'ayer') return `ayer, ${fechaCorta(r.desde)}`;
  if (r.desde === r.hasta) return fechaCorta(r.desde);
  return `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
}
