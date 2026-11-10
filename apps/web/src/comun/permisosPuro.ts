/**
 * Regla única de «tiene este permiso» y «ve este módulo», sin React. La usan la sesión (tiene), el menú del admin
 * y el cuadro de accesos de Usuarios, para que el cuadro nunca contradiga lo que el usuario ve de verdad.
 */

/** ADMIN: control total. Si no, el permiso exacto o, para un módulo suelto ('caja'), cualquier 'caja/…'. */
export function tienePermiso(permisos: readonly string[], permiso: string, esAdmin = false): boolean {
  if (esAdmin) return true;
  return permisos.some((p) => p === permiso || p.startsWith(`${permiso}/`));
}

/** Un módulo aparece en el menú si no exige permiso o si `tiene` lo concede. */
export function moduloVisible(modulo: { permisoMinimo?: string }, tiene: (permiso: string) => boolean): boolean {
  return !modulo.permisoMinimo || tiene(modulo.permisoMinimo);
}
