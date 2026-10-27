-- Inserción idempotente de permisos para el módulo de vouchers
INSERT INTO "permiso" ("modulo", "accion")
VALUES 
  ('vouchers', 'subir'),
  ('vouchers', 'ver')
ON CONFLICT ("modulo", "accion") DO NOTHING;

-- Asignación de permisos al rol ADMIN
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'ADMIN', p."id"
FROM "permiso" p
WHERE (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir',
    'vouchers/ver'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;

-- Asignación de permisos al rol CAJERO
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'CAJERO', p."id"
FROM "permiso" p
WHERE (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir',
    'vouchers/ver'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;

-- Asignación de permisos al rol MOZO
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'MOZO', p."id"
FROM "permiso" p
WHERE (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
