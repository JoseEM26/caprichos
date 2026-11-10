/**
 * «Mesa lista» llega por la sala común a todo el personal: el sonido y el aviso son del mozo dueño de la mesa.
 * Otro mozo no los recibe; quien administra o cobra (ADMIN, SUPERVISOR, caja) sí, para seguir el salón.
 */
export function debeAvisarMesaLista(
  mozoPartyId: unknown,
  sesion: { usuario?: { partyId: string; rol: string; roles?: string[] } | null; tiene: (p: string) => boolean } | null,
): boolean {
  if (!mozoPartyId || !sesion?.usuario) return true;
  if (String(mozoPartyId) === String(sesion.usuario.partyId)) return true;
  const roles = (sesion.usuario.roles ?? [sesion.usuario.rol]).map((r) => r.toUpperCase());
  return roles.includes('ADMIN') || roles.includes('SUPERVISOR') || sesion.tiene('caja/ver');
}
