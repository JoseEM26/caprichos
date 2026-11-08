import { CONFIG_VACIA } from './configVacia';
import type { ConfigEquipoImpresion, EquipoEstadoImpresion } from '@caprichos/compartido';

/** Hace cuánto fue algo, en palabras: «hace 3 min», «hace 2 h», «hace 1 día». */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return 'nunca se conectó';
  const min = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** Una PC cuenta como conectada si latió hace menos de 1 minuto. */
export const estaConectada = (e: Pick<EquipoEstadoImpresion, 'conectado'>) => e.conectado;

/** Configuración de la PC tal como la ve el panel (una PC de un servidor viejo se trata como nueva). */
export const configDe = (e: EquipoEstadoImpresion | undefined): ConfigEquipoImpresion => (e?.config ? { ...CONFIG_VACIA, ...e.config } : CONFIG_VACIA);

export const esNueva = (e: EquipoEstadoImpresion | undefined) => !!e && !configDe(e).configurado;

/** Las PC nuevas (falta configurar) arriba de todo; el resto, en su orden. */
export function ordenarEquipos<T extends { deviceKeyId: string }>(equipos: T[], detalle: (id: string) => EquipoEstadoImpresion | undefined): T[] {
  const peso = (e: T) => (esNueva(detalle(e.deviceKeyId)) ? 0 : 1);
  return [...equipos].sort((a, b) => peso(a) - peso(b));
}

export const mismaConfig = (a: ConfigEquipoImpresion, b: ConfigEquipoImpresion) => JSON.stringify(a) === JSON.stringify(b);

/** Alterna un id en una lista de áreas (chips). */
export const alternarArea = (lista: string[], id: string): string[] => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
