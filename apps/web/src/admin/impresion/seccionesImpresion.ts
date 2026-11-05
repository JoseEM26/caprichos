import { maquinasConProblema, programaApagado, type MaquinasImpresion } from './useEstadoMaquinas';

/** Secciones del módulo Impresión de Configuración. Van en ?tab=impresion&seccion=<id>. */
export const SECCIONES_IMPRESION = ['mapa', 'equipos', 'cola'] as const;
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
 * Enlaces viejos: ?tab=mapa-impresion → mapa; ?tab=impresion sin sección (era «Impresión de etiquetas») → equipos.
 */
export function seccionDesdeUrl(tab: string | null, seccion: string | null, recordada: SeccionImpresion | null): SeccionImpresion {
  if (tab === 'mapa-impresion') return 'mapa';
  if (esSeccion(seccion)) return seccion;
  if (tab === 'impresion' && !seccion) return 'equipos';
  return recordada ?? 'mapa';
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
