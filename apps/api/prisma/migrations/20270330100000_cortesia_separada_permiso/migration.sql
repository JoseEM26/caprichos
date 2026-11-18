-- Cortesía POR SEPARADO (sin pedido propio): permiso nuevo cortesias/dar_separada, solo para CAJERO y MOZO (y ADMIN, que tiene todo).
-- SUPERVISOR y el resto NO lo reciben; siguen con cortesias/dar (cortesía dentro de su pedido, sin cambios).
-- Aditiva e idempotente: solo inserta; nunca quita vínculos. El sincronizador de arranque hace lo mismo desde MATRIZ.
-- Reversible: DELETE FROM "rol_permiso" WHERE "permiso_id" IN (SELECT "id" FROM "permiso" WHERE "modulo" = 'cortesias' AND "accion" = 'dar_separada');
--             DELETE FROM "permiso" WHERE "modulo" = 'cortesias' AND "accion" = 'dar_separada';

INSERT INTO "permiso" ("modulo", "accion") VALUES ('cortesias', 'dar_separada')
ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "permiso" p
JOIN "rol" r ON r."codigo" IN ('ADMIN', 'CAJERO', 'MOZO')
WHERE p."modulo" = 'cortesias' AND p."accion" = 'dar_separada'
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
