-- Rol SUPERVISOR (apps/api/src/modulos/acceso/permisos.ts). Idempotente: se puede correr en bases
-- existentes (demo y producción) o en una vacía sin tocar usuarios ni contraseñas.
-- Permisos = unión de CAJERO y MOZO, más supervisor/ver_codigo. No recibe ningún permiso de administración.

-- La base restringe los códigos de rol (ck_rol_codigo, migración base_acceso). Se reemplaza para admitir SUPERVISOR.
ALTER TABLE "rol" DROP CONSTRAINT IF EXISTS "ck_rol_codigo";
ALTER TABLE "rol" ADD CONSTRAINT "ck_rol_codigo" CHECK (
  "codigo" IN ('ADMIN','CAJERO','COCINA','MOZO','CALLCENTER','ALMACEN','REPARTIDOR','SUPERVISOR'));

INSERT INTO "rol" ("codigo", "nombre")
VALUES ('SUPERVISOR', 'Supervisor')
ON CONFLICT ("codigo") DO NOTHING;

-- Permisos que usa la matriz (las filas ya existentes no se tocan)
INSERT INTO "permiso" ("modulo", "accion")
VALUES
  ('pedidos', 'ver'),
  ('pedidos', 'crear'),
  ('pedidos', 'cambiar_estado'),
  ('caja', 'abrir'),
  ('caja', 'cobrar'),
  ('caja', 'movimientos'),
  ('caja', 'cerrar'),
  ('caja', 'ver'),
  ('cocina', 'ver'),
  ('catalogo', 'ver'),
  ('comprobantes', 'ver'),
  ('comprobantes', 'reimprimir'),
  ('mesas', 'ver'),
  ('mesas', 'liberar'),
  ('mesas', 'abrir'),
  ('repartos', 'ver'),
  ('repartos', 'liquidar'),
  ('vouchers', 'subir'),
  ('vouchers', 'ver'),
  ('plano', 'ver'),
  ('reservas', 'ver'),
  ('reservas', 'crear'),
  ('reservas', 'editar'),
  ('iniciativas', 'ver'),
  ('iniciativas', 'crear'),
  ('iniciativas', 'comentar'),
  ('notificaciones', 'ver'),
  ('notificaciones', 'marcar'),
  ('supervisor', 'ver_codigo'),
  ('supervisor', 'gestionar_codigo')
ON CONFLICT ("modulo", "accion") DO NOTHING;

-- Matriz del SUPERVISOR: lo de CAJERO y MOZO, más ver el código
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'SUPERVISOR', p."id"
FROM "permiso" p
WHERE EXISTS (SELECT 1 FROM "rol" r WHERE r."codigo" = 'SUPERVISOR')
  AND (p."modulo" || '/' || p."accion") IN (
    'pedidos/ver',
    'pedidos/crear',
    'pedidos/cambiar_estado',
    'caja/abrir',
    'caja/cobrar',
    'caja/movimientos',
    'caja/cerrar',
    'caja/ver',
    'cocina/ver',
    'catalogo/ver',
    'comprobantes/ver',
    'comprobantes/reimprimir',
    'mesas/ver',
    'mesas/liberar',
    'mesas/abrir',
    'repartos/ver',
    'repartos/liquidar',
    'vouchers/subir',
    'vouchers/ver',
    'plano/ver',
    'reservas/ver',
    'reservas/crear',
    'reservas/editar',
    'iniciativas/ver',
    'iniciativas/crear',
    'iniciativas/comentar',
    'notificaciones/ver',
    'notificaciones/marcar',
    'supervisor/ver_codigo'
  )
ON CONFLICT DO NOTHING;

-- El ADMIN recibe los dos permisos del código (generar, rotar y desbloquear es solo suyo)
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'ADMIN', p."id"
FROM "permiso" p
WHERE EXISTS (SELECT 1 FROM "rol" r WHERE r."codigo" = 'ADMIN')
  AND (p."modulo" || '/' || p."accion") IN ('supervisor/ver_codigo', 'supervisor/gestionar_codigo')
ON CONFLICT DO NOTHING;
