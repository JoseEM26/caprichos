-- Renombra las áreas de cocina: Barra -> Bebidas, Cocina -> Salados (Postres sin cambio).
-- Solo cambia el nombre: no toca ids ni impresoras (la clave ticketera_* es técnica).
-- Idempotente: si ya tienen el nombre nuevo, no hace nada.
UPDATE "area_cocina" SET "nombre" = 'Bebidas' WHERE "nombre" = 'Barra';
UPDATE "area_cocina" SET "nombre" = 'Salados' WHERE "nombre" = 'Cocina';

-- Los lugares de stock de tipo AREA llevan el nombre de su área (enlace por area_id).
-- Se renombran igual, salvo que ya exista un lugar con ese nombre (nombre único).
UPDATE "lugar_stock" AS l
SET "nombre" = a."nombre"
FROM "area_cocina" AS a
WHERE l."area_id" = a."id"
  AND l."nombre" <> a."nombre"
  AND NOT EXISTS (SELECT 1 FROM "lugar_stock" AS x WHERE x."nombre" = a."nombre");
