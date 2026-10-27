-- Inserción idempotente de permisos para el módulo de mascota Capri (mas-api)
INSERT INTO "permiso" ("modulo", "accion")
VALUES 
  ('mascota', 'ver'),
  ('mascota', 'editar')
ON CONFLICT ("modulo", "accion") DO NOTHING;

-- Asignación de permisos al rol ADMIN
INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'ADMIN', p."id"
FROM "permiso" p
WHERE (p."modulo" || '/' || p."accion") IN (
    'mascota/ver',
    'mascota/editar'
)
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
