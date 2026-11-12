/** Permisos relevantes para el escritorio de cada rol (resumen de apps/api/src/modulos/acceso/permisos.ts, solo para pruebas). */
const CAJERO = ['pedidos/ver', 'caja/ver', 'cocina/ver', 'repartos/ver', 'mesas/ver', 'notificaciones/ver', 'iniciativas/ver'];
const MOZO = ['pedidos/ver', 'plano/ver', 'mesas/ver', 'reservas/ver', 'repartos/seguir', 'notificaciones/ver', 'iniciativas/ver'];

export const MATRIZ_PARA_PRUEBA: Record<string, string[]> = {
  CAJERO,
  MOZO,
  COCINA: ['pedidos/ver', 'cocina/ver', 'stock/ver', 'notificaciones/ver'],
  ALMACEN: ['stock/ver', 'compras/ver', 'notificaciones/ver'],
  REPARTIDOR: ['repartos/ver', 'notificaciones/ver'],
  SUPERVISOR: [...new Set([...CAJERO, ...MOZO, 'escritorio/operativo', 'escritorio/cumpleanos', 'analisis/ver'])],
  MARKETING: ['novedades/ver', 'carta_diseno/ver', 'notificaciones/ver'],
};
