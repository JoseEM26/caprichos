/** Pertenencia: el usuario tiene el rol como principal o como extra. Sin lista de roles, vale solo el principal. */
export function tieneRolUsuario(usuario: { rol?: string; roles?: string[] } | null | undefined, rol: string): boolean {
  const lista = usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
  return lista.some((r) => r.toUpperCase() === rol.toUpperCase());
}

/** Mozo que solo es mozo: tiene MOZO y ningún rol de alcance amplio (ADMIN, CAJERO, SUPERVISOR). */
export function esSoloMozoUsuario(usuario: { rol?: string; roles?: string[] } | null | undefined): boolean {
  return tieneRolUsuario(usuario, 'MOZO') && !['ADMIN', 'CAJERO', 'SUPERVISOR'].some((r) => tieneRolUsuario(usuario, r));
}

/** Marketing y diseño sin ningún otro rol: no tiene Escritorio operativo; entra directo a su primer módulo. */
export function esSoloMarketing(usuario: { rol?: string; roles?: string[] } | null | undefined): boolean {
  const lista = usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
  return lista.length > 0 && lista.every((r) => r.toUpperCase() === 'MARKETING');
}
