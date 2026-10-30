-- Inserción idempotente de permisos para el módulo de vouchers
INSERT INTO "permiso" ("modulo", "accion")
VALUES 
  ('vouchers', 'subir'),
  ('vouchers', 'ver')
ON CONFLICT ("modulo", "accion") DO NOTHING;

-- Los roles los crea el seed: en una base nueva todavía no existen y el servidor sincroniza sus permisos al arrancar.
-- Asignación de permisos al rol ADMIN
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'ADMIN', p."id"
FROM "permiso" p
WHERE EXISTS (SELECT 1 FROM "rol" r WHERE r."codigo" = 'ADMIN')
  AND (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir',
    'vouchers/ver'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;

-- Asignación de permisos al rol CAJERO
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'CAJERO', p."id"
FROM "permiso" p
WHERE EXISTS (SELECT 1 FROM "rol" r WHERE r."codigo" = 'CAJERO')
  AND (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir',
    'vouchers/ver'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;

-- Asignación de permisos al rol MOZO
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'MOZO', p."id"
FROM "permiso" p
WHERE EXISTS (SELECT 1 FROM "rol" r WHERE r."codigo" = 'MOZO')
  AND (p."modulo" || '/' || p."accion") IN (
    'vouchers/subir'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
