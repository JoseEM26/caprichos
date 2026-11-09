export type Frescura = 'EN_VIVO' | 'HACE_MINUTOS' | 'SIN_SENAL';

export interface UbicacionVivo {
  repartidorId: string;
  nombre: string;
  telefono?: string | null;
  lat: number;
  lng: number;
  precision?: number | null;
  en: string; // ISO
  pedidos: Array<{ codigo: string; etapa?: string; direccion?: string | null; lat?: number | null; lng?: number | null }>;
}

/** Texto corto «hace 20 s» / «hace 3 min». */
export function textoHace(en: string, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - new Date(en).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`;
}

/** Verde: menos de 5 min (en vivo). Ámbar: 5 a 15 min. Gris: más de 15 min (sin señal; el servidor ya la borra). */
export function frescuraDe(en: string, ahora: number): { clave: Frescura; texto: string; color: string } {
  const ms = ahora - new Date(en).getTime();
  if (ms <= 5 * 60_000) return { clave: 'EN_VIVO', texto: 'En vivo', color: '#2F7A45' };
  if (ms <= 15 * 60_000) return { clave: 'HACE_MINUTOS', texto: textoHace(en, ahora), color: '#B2500F' };
  return { clave: 'SIN_SENAL', texto: 'Sin señal', color: '#2C4C5D' };
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}
