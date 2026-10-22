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
  { modulo: 'catalogo', accion: 'ver' },
  { modulo: 'catalogo', accion: 'crear' },
  { modulo: 'catalogo', accion: 'editar' },
  { modulo: 'catalogo', accion: 'agotar' },
  { modulo: 'catalogo', accion: 'ocultar' },
  { modulo: 'local', accion: 'ver' },
  { modulo: 'local', accion: 'editar' },
  { modulo: 'archivos', accion: 'subir' },
  { modulo: 'archivos', accion: 'ver' },
  // Zonas y Pedidos (Ola 3)
  { modulo: 'pedidos', accion: 'ver' },
  { modulo: 'pedidos', accion: 'cambiar_estado' },
  { modulo: 'pedidos', accion: 'anular' },
  { modulo: 'zonas', accion: 'ver' },
  { modulo: 'zonas', accion: 'editar' },
  // Caja y Repartos (Ola 4)
  { modulo: 'caja', accion: 'abrir' },
  { modulo: 'caja', accion: 'cobrar' },
  { modulo: 'caja', accion: 'movimientos' },
  { modulo: 'caja', accion: 'cerrar' },
  { modulo: 'caja', accion: 'ver' },
  { modulo: 'repartos', accion: 'ver' },
  { modulo: 'repartos', accion: 'tomar' },
  { modulo: 'repartos', accion: 'entregar' },
  { modulo: 'repartos', accion: 'reportar' },
  { modulo: 'repartos', accion: 'liquidar' },
] as const;

export const MATRIZ: Record<string, string[]> = {
  ADMIN: PERMISOS.map((p) => `${p.modulo}/${p.accion}`),
  CAJERO: [
    'pedidos/ver',
    'pedidos/cambiar_estado',
    'pedidos/anular',
    'caja/abrir',
    'caja/cobrar',
    'caja/movimientos',
    'caja/cerrar',
    'caja/ver',
    'repartos/ver',
    'repartos/liquidar',
  ],
  COCINA: ['pedidos/ver', 'pedidos/cambiar_estado'],
  MOZO: [],
  CALLCENTER: [],
  ALMACEN: [],
  REPARTIDOR: [
    'repartos/ver',
    'repartos/tomar',
    'repartos/entregar',
    'repartos/reportar',
  ],
};
