import { moduloVisible, tienePermiso } from '../../comun/permisosPuro';

export interface AccesoUsuario {
  id: string;
  nombre: string;
  activo: boolean;
  /** ADMIN: control total. */
  todos: boolean;
  roles: Array<{ rol: string; vence_en: string | null }>;
  /** Permisos efectivos (modulo/accion): roles + extra vigentes. */
  permisos: string[];
  /** Los que vienen solo de un permiso extra propio. */
  permisosExtra: Array<{ permiso: string; vence_en: string | null }>;
}

export type Celda = 'no' | 'rol' | 'extra';

/** Misma regla que el menú (moduloVisible). 'extra' = lo ve solo por un permiso extra propio, no por su rol. */
export function celdaModulo(u: AccesoUsuario, modulo: { permisoMinimo?: string }): Celda {
  if (!moduloVisible(modulo, (p) => tienePermiso(u.permisos, p, u.todos))) return 'no';
  const sinExtra = u.permisos.filter((p) => !u.permisosExtra.some((e) => e.permiso === p));
  return moduloVisible(modulo, (p) => tienePermiso(sinExtra, p, u.todos)) ? 'rol' : 'extra';
}

/** Usuarios que ven el módulo. */
export function contarModulo(usuarios: AccesoUsuario[], modulo: { permisoMinimo?: string }): number {
  return usuarios.filter((u) => celdaModulo(u, modulo) !== 'no').length;
}
