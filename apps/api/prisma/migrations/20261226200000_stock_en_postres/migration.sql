-- Stock de productos terminados en la categoría POSTRES (no ocultos).
-- Pura SQL, idempotente y aditiva: no toca otras categorías ni saldos existentes.
-- La categoría se busca por nombre (sin distinguir mayúsculas), nunca por id. Si no existe, no hace nada.

-- 1) Controlan stock
UPDATE "producto" p
   SET "controla_stock" = true
  FROM "categoria" c
 WHERE c."id" = p."categoria_id"
   AND lower(c."nombre") = 'postres'
   AND p."oculto" = false
   AND p."controla_stock" = false;

-- 2) Fila de stock en cero en el lugar principal, si el producto aún no tiene ninguna.
--    Lugar principal = el mismo orden que lugarDelProducto(): área del producto, luego «Salados», luego almacén.
--    La tabla stock no tiene unicidad: el NOT EXISTS evita duplicar filas (y no pisa saldos).
WITH destino AS (
  SELECT p."id" AS producto_id,
         COALESCE(
           (SELECT l."id" FROM "lugar_stock" l
             WHERE l."tipo" = 'AREA' AND l."area_id" = c."area_id"
             ORDER BY l."id" LIMIT 1),
           (SELECT l."id" FROM "lugar_stock" l
             WHERE l."nombre" = 'Salados'
             ORDER BY l."id" LIMIT 1),
           (SELECT l."id" FROM "lugar_stock" l
             WHERE l."tipo" = 'ALMACEN'
             ORDER BY l."id" LIMIT 1)
         ) AS lugar_id
    FROM "producto" p
    JOIN "categoria" c ON c."id" = p."categoria_id"
   WHERE lower(c."nombre") = 'postres'
     AND p."oculto" = false
)
INSERT INTO "stock" ("producto_id", "lugar_id", "cantidad")
SELECT d.producto_id, d.lugar_id, 0
  FROM destino d
 WHERE d.lugar_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "stock" s WHERE s."producto_id" = d.producto_id);

-- 3) Sabores de esos productos arrancan en cero si no tienen saldo (stock_sabor tiene unicidad por sabor).
INSERT INTO "stock_sabor" ("sabor_id", "cantidad")
SELECT s."id", 0
  FROM "sabor" s
  JOIN "producto" p ON p."id" = s."producto_id"
  JOIN "categoria" c ON c."id" = p."categoria_id"
 WHERE lower(c."nombre") = 'postres'
   AND p."oculto" = false
ON CONFLICT ("sabor_id") DO NOTHING;
