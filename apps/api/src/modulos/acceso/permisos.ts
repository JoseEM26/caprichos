export interface DefinicionRol {
  codigo: string;
  nombre: string;
}

export interface DefinicionPermiso {
  modulo: string;
  accion: string;
}

export const ROLES: readonly DefinicionRol[] = [
  { codigo: 'ADMIN', nombre: 'Administrador' },
  { codigo: 'CAJERO', nombre: 'Cajero' },
  { codigo: 'COCINA', nombre: 'Cocina' },
  { codigo: 'MOZO', nombre: 'Mozo' },
  { codigo: 'CALLCENTER', nombre: 'Call Center' },
  { codigo: 'ALMACEN', nombre: 'Almacén' },
  { codigo: 'REPARTIDOR', nombre: 'Repartidor' },
] as const;

export const PERMISOS: readonly DefinicionPermiso[] = [
  { modulo: 'usuarios', accion: 'ver' },
  { modulo: 'usuarios', accion: 'crear' },
  { modulo: 'usuarios', accion: 'editar' },
  { modulo: 'usuarios', accion: 'desactivar' },
  { modulo: 'usuarios', accion: 'reactivar' },
  { modulo: 'usuarios', accion: 'restablecer' },
  { modulo: 'configuracion', accion: 'ver' },
  { modulo: 'configuracion', accion: 'editar' },
  { modulo: 'auditoria', accion: 'ver' },
] as const;

export const MATRIZ: Record<string, string[]> = {
  ADMIN: PERMISOS.map((p) => `${p.modulo}/${p.accion}`),
  CAJERO: [],
  COCINA: [],
  MOZO: [],
  CALLCENTER: [],
  ALMACEN: [],
  REPARTIDOR: [],
};
