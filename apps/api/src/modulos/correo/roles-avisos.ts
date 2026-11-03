/** Roles que, por defecto, reciben los avisos del sistema por correo (la casilla se puede cambiar). */
export const ROLES_AVISOS_CORREO_POR_DEFECTO = ['ADMIN', 'SUPERVISOR'] as const;

export const rolRecibeAvisosPorDefecto = (rol: string): boolean =>
  (ROLES_AVISOS_CORREO_POR_DEFECTO as readonly string[]).includes(rol);
