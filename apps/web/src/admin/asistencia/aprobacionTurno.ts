import type { ParteAprobacion, SolicitudTurno } from './turnosApi';

/** Quién mira la pantalla: su partyId (texto, como en la sesión) y sus roles. */
export interface QuienMira {
  partyId: string;
  roles: string[];
}

/** Partes que puede firmar un rol: SUPERVISOR firma Supervisión; ADMIN firma Administración (puede tener las dos). */
export function partesDe(roles: string[]): ParteAprobacion[] {
  return [...(roles.includes('SUPERVISOR') ? (['SUPERVISION'] as ParteAprobacion[]) : []), ...(roles.includes('ADMIN') ? (['ADMINISTRACION'] as ParteAprobacion[]) : [])];
}

/**
 * La parte que esta persona puede firmar ahora, o null si no le toca: participa en el pedido, ya firmó una parte,
 * o su parte ya está firmada. Igual que el servidor: con dos roles, firma primero Supervisión si falta.
 */
export function parteQuePuedoAprobar(s: SolicitudTurno, quien: QuienMira): ParteAprobacion | null {
  const a = s.aprobacion;
  if (s.estado !== 'PENDIENTE_APRUEBA' || !a) return null;
  if (String(s.solicitante.partyId) === quien.partyId || String(s.reemplazo.partyId) === quien.partyId) return null;
  const yaFirme = [a.supervision?.porId, a.administracion?.porId].some((id) => id != null && String(id) === quien.partyId);
  if (yaFirme) return null;
  return partesDe(quien.roles).find((p) => a.faltan.includes(p)) ?? null;
}

/** Texto corto del avance: qué falta o quién aprobó cada parte. */
export function textoAprobacion(s: SolicitudTurno): string {
  const a = s.aprobacion;
  if (!a) return '';
  if (s.estado === 'APROBADA') {
    if (!a.supervision && !a.administracion) return 'Aprobada';
    return `Aprobada por ${a.supervision?.nombre ?? 'Supervisión'} (supervisión) y ${a.administracion?.nombre ?? 'Administración'} (administración)`;
  }
  if (s.estado !== 'PENDIENTE_APRUEBA') return '';
  if (a.faltan.length === 2) return 'Falta supervisora y administrador';
  return a.faltan[0] === 'SUPERVISION' ? 'Falta supervisora' : 'Falta administrador';
}

export const NOMBRE_PARTE: Record<ParteAprobacion, string> = { SUPERVISION: 'Supervisión', ADMINISTRACION: 'Administración' };
