/**
 * Catálogo de módulos del admin que se pueden dar o quitar a un ROL desde Usuarios › Qué ve cada rol.
 * Lo usan la API (qué permisos conceder/quitar) y la web (el cuadro). La web comprueba en un test que `minimo`
 * coincide con el `permisoMinimo` de cada módulo de apps/web/src/admin/modulos.ts.
 *
 * Reglas:
 * - Dar un módulo = dar su permiso mínimo (`minimo`) y las LECTURAS básicas (`lecturas`) para que la pantalla cargue.
 *   Nunca se dan acciones de escritura (salvo que sean el mínimo, p. ej. pedidos/crear de «Mis pedidos»).
 * - Quitar un módulo = quitar solo su permiso mínimo (los permisos de acción sueltos no se tocan). Las lecturas
 *   auxiliares nunca se quitan (otro módulo puede depender de ellas).
 * - Varios módulos comparten el mismo mínimo (p. ej. Caja y Cierre): se mueven juntos.
 * - `bloqueado`: no se puede quitar ni dar (el módulo es obligatorio para todo el personal).
 */
export interface ModuloRolCatalogo {
  clave: string;
  /** Mismo valor que `permisoMinimo` del módulo en la web ('repartos' = cualquier repartos/…). */
  minimo: string;
  /** Permiso concreto que se concede cuando `minimo` es un módulo suelto. */
  otorga?: string;
  /** Lecturas básicas que se conceden junto con el mínimo. */
  lecturas?: string[];
  bloqueado?: boolean;
}

export const MODULOS_ROL: readonly ModuloRolCatalogo[] = [
  { clave: 'iniciativas', minimo: 'iniciativas/ver' },
  { clave: 'caja', minimo: 'caja/ver', lecturas: ['pedidos/ver'] },
  { clave: 'mensajes', minimo: 'mensajes/ver' },
  { clave: 'cierre', minimo: 'caja/ver', lecturas: ['pedidos/ver'] },
  { clave: 'propinas', minimo: 'propinas/ver' },
  { clave: 'cocina', minimo: 'cocina/ver', lecturas: ['pedidos/ver'] },
  { clave: 'repartos', minimo: 'repartos', otorga: 'repartos/ver', lecturas: ['pedidos/ver'] },
  { clave: 'reservas', minimo: 'reservas/ver', lecturas: ['mesas/ver'] },
  { clave: 'mis-pedidos', minimo: 'pedidos/crear', lecturas: ['pedidos/ver', 'mesas/ver'] },
  { clave: 'comprobantes', minimo: 'comprobantes/ver', lecturas: ['pedidos/ver'] },
  { clave: 'reclamos', minimo: 'reclamos/ver' },
  { clave: 'clientes', minimo: 'clientes/ver' },
  { clave: 'creditos', minimo: 'creditos/ver' },
  { clave: 'productos', minimo: 'catalogo/ver' },
  { clave: 'listas', minimo: 'catalogo/ver' },
  { clave: 'ofertas', minimo: 'ofertas/ver' },
  { clave: 'compras', minimo: 'stock/ver', lecturas: ['compras/ver', 'proveedores/ver', 'pedidos_proveedor/ver'] },
  { clave: 'almacen', minimo: 'stock/ver', lecturas: ['almacen/ver'] },
  { clave: 'apertura', minimo: 'almacen/apertura' },
  { clave: 'stock', minimo: 'stock/ver' },
  { clave: 'recetas', minimo: 'stock/ver', lecturas: ['recetas/ver'] },
  { clave: 'analisis', minimo: 'analisis/ver' },
  { clave: 'informes', minimo: 'auditoria/ver', lecturas: ['informes/ver'] },
  { clave: 'mapa', minimo: 'zonas/ver' },
  { clave: 'indicadores', minimo: 'auditoria/ver', lecturas: ['indicadores/ver'] },
  { clave: 'disenador', minimo: 'carta_diseno/ver' },
  { clave: 'novedades', minimo: 'novedades/ver' },
  { clave: 'conocenos', minimo: 'conocenos/ver' },
  { clave: 'destacadas', minimo: 'destacadas/ver' },
  { clave: 'resenas', minimo: 'resenas/ver' },
  { clave: 'paleta', minimo: 'paleta/ver' },
  { clave: 'mascota', minimo: 'mascota/ver' },
  { clave: 'mirest', minimo: 'local/ver' },
  { clave: 'zonas', minimo: 'zonas/ver' },
  { clave: 'usuarios', minimo: 'usuarios/ver' },
  { clave: 'historial', minimo: 'auditoria/ver' },
  { clave: 'asistencia', minimo: 'asistencia/administrar' },
  { clave: 'asistencia-pantalla', minimo: 'asistencia/pantalla' },
  // Marcar asistencia es obligatorio para todo el personal con horario: no se quita.
  { clave: 'mi-asistencia', minimo: 'asistencia/marcar', bloqueado: true },
  { clave: 'pantallas', minimo: 'pantallas/ver' },
  { clave: 'plano', minimo: 'plano/ver' },
  { clave: 'notificaciones', minimo: 'notificaciones/ver', bloqueado: true },
];

/** Misma regla que la web (permisosPuro.tienePermiso) sin ADMIN: permiso exacto o, si es un módulo suelto, cualquier 'modulo/…'. */
export function coincideMinimo(permiso: string, minimo: string): boolean {
  return permiso === minimo || permiso.startsWith(`${minimo}/`);
}

/** El módulo se ve con este conjunto de permisos. */
export function moduloRolVisible(m: ModuloRolCatalogo, permisos: Iterable<string>): boolean {
  for (const p of permisos) if (coincideMinimo(p, m.minimo)) return true;
  return false;
}

/** Permisos que hay que dar para que el módulo funcione: el concreto del mínimo y sus lecturas. */
export function permisosAConceder(m: ModuloRolCatalogo): string[] {
  return [m.otorga ?? m.minimo, ...(m.lecturas ?? [])];
}
