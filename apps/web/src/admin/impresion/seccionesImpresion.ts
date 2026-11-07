import { maquinasConProblema, programaApagado, type MaquinasImpresion } from './useEstadoMaquinas';

/** Secciones del módulo Impresión de Configuración. Van en ?tab=impresion&seccion=<id>. */
/** «facil» es la pantalla de 3 pasos (la de siempre); mapa, equipos y cola son la «Vista avanzada». */
export const SECCIONES_IMPRESION = ['facil', 'mapa', 'equipos', 'cola'] as const;
/** Las tres de la vista avanzada (llevan pestañas). */
export const SECCIONES_AVANZADAS = ['mapa', 'equipos', 'cola'] as const;
export type SeccionImpresion = (typeof SECCIONES_IMPRESION)[number];

/** Última sección que vio el dueño: al volver a Impresión se abre esa. */
export const LLAVE_SECCION_IMPRESION = 'cfg_impresion_seccion';

const esSeccion = (s: string | null | undefined): s is SeccionImpresion =>
  (SECCIONES_IMPRESION as readonly string[]).includes(s ?? '');

export function leerSeccionRecordada(): SeccionImpresion | null {
  try {
    const v = localStorage.getItem(LLAVE_SECCION_IMPRESION);
    return esSeccion(v) ? v : null;
  } catch {
    return null;
  }
}

export function guardarSeccionRecordada(seccion: SeccionImpresion): void {
  try {
    localStorage.setItem(LLAVE_SECCION_IMPRESION, seccion);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/**
 * Sección que corresponde a una URL de Configuración.
 * Enlaces viejos: ?tab=mapa-impresion → mapa. Sin sección se abre siempre la pantalla fácil de 3 pasos
 * (ya no se recuerda la última sección: así el dueño no cae en la vista avanzada por accidente).
 */
export function seccionDesdeUrl(tab: string | null, seccion: string | null, _recordada?: SeccionImpresion | null): SeccionImpresion {
  if (tab === 'mapa-impresion') return 'mapa';
  if (esSeccion(seccion)) return seccion;
  return 'facil';
}

export type NivelSalud = 'ok' | 'aviso' | 'falla' | 'sin_datos';

/** Luz del título: verde todo conectado, ámbar una máquina sin conexión, roja ninguna o sin programa. */
export function saludEquipos(maquinas: MaquinasImpresion | null | undefined): { nivel: NivelSalud; texto: string } {
  if (!maquinas) return { nivel: 'sin_datos', texto: 'Sin datos de los equipos' };
  if (programaApagado(maquinas)) return { nivel: 'falla', texto: 'El programa de impresión no está corriendo' };
  const sinConexion = maquinasConProblema(maquinas).length;
  if (sinConexion >= 2) return { nivel: 'falla', texto: 'Ninguna impresora conectada' };
  if (sinConexion === 1) return { nivel: 'aviso', texto: 'Una impresora sin conexión' };
  return { nivel: 'ok', texto: 'Equipos conectados' };
}
