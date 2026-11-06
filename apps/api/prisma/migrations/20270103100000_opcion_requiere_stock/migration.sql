-- OPCIÓN QUE REQUIERE STOCK: una opción de grupo (p. ej. «2 Donas») puede ligarse al stock real de uno o más
-- productos (o de un sabor). Sin filas, la opción sigue como hasta ahora (solo agotado_hasta).
-- Tabla nueva, aditiva: no cambia ni borra datos existentes. Idempotente.
--
-- Siembra (solo dentro de los grupos de los productos ANFITRIONES de combo: oferta.tipo = 'COMBO' con
-- alcance_producto_id). Empareja el nombre normalizado (lower/trim) del valor de la opción:
--   «2 Donas»                  -> DONAS ARTESANALES x2
--   «2 Galletas choco chips»   -> GALLETA CHOCO CHIPS x2
--   «1 Dona + 1 Galleta»       -> DONAS ARTESANALES x1 + GALLETA CHOCO CHIPS x1
--   «1 X» o «X»                -> el producto llamado X (sin el «1 » inicial) x1, si existe por nombre exacto
--   «Dona N · Sabor» (grupo)   -> DONAS ARTESANALES, sabor del mismo nombre, x1, si existe
-- Si no empareja nada, no inserta: nunca falla. Una segunda ejecución no inserta nada (ON CONFLICT).

CREATE TABLE IF NOT EXISTS "opcion_requiere" (
    "id" BIGSERIAL NOT NULL,
    "opcion_id" BIGINT NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "sabor_id" BIGINT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "opcion_requiere_pkey" PRIMARY KEY ("id")
);

-- NULL en sabor_id no cuenta como duplicado en un UNIQUE normal: se indexa COALESCE(sabor_id, 0) (los ids de sabor son > 0)
CREATE UNIQUE INDEX IF NOT EXISTS "opcion_requiere_opcion_producto_sabor_key" ON "opcion_requiere" ("opcion_id", "producto_id", COALESCE("sabor_id", 0));
CREATE INDEX IF NOT EXISTS "opcion_requiere_producto_id_idx" ON "opcion_requiere" ("producto_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opcion_requiere_opcion_id_fkey') THEN
    ALTER TABLE "opcion_requiere" ADD CONSTRAINT "opcion_requiere_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opcion_requiere_producto_id_fkey') THEN
    ALTER TABLE "opcion_requiere" ADD CONSTRAINT "opcion_requiere_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opcion_requiere_sabor_id_fkey') THEN
    ALTER TABLE "opcion_requiere" ADD CONSTRAINT "opcion_requiere_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

WITH anfitriones AS (
  SELECT DISTINCT ofe.alcance_producto_id AS producto_id
  FROM oferta ofe
  WHERE ofe.tipo = 'COMBO' AND ofe.alcance_producto_id IS NOT NULL
),
oh AS (
  -- Opciones de los grupos ligados a un anfitrión de combo, con el nombre normalizado de la opción y del grupo
  SELECT DISTINCT o.id AS opcion_id, lower(trim(lv.nombre)) AS n, lower(trim(g.nombre)) AS grupo_n
  FROM opcion o
  JOIN lista_valor lv ON lv.id = o.valor_id
  JOIN grupo_opciones g ON g.id = o.grupo_id
  JOIN producto_grupo pg ON pg.grupo_id = g.id
  WHERE pg.producto_id IN (SELECT producto_id FROM anfitriones)
),
donas AS (SELECT p.id FROM producto p WHERE lower(trim(p.nombre)) = 'donas artesanales'),
galletas AS (SELECT p.id FROM producto p WHERE lower(trim(p.nombre)) = 'galleta choco chips'),
req AS (
  -- 2 Donas
  SELECT oh.opcion_id, d.id AS producto_id, NULL::BIGINT AS sabor_id, 2 AS cantidad
  FROM oh CROSS JOIN donas d WHERE oh.n = '2 donas'
  UNION ALL
  -- 2 Galletas choco chips
  SELECT oh.opcion_id, g.id, NULL::BIGINT, 2
  FROM oh CROSS JOIN galletas g WHERE oh.n = '2 galletas choco chips'
  UNION ALL
  -- 1 Dona + 1 Galleta
  SELECT oh.opcion_id, d.id, NULL::BIGINT, 1
  FROM oh CROSS JOIN donas d WHERE oh.n = '1 dona + 1 galleta'
  UNION ALL
  SELECT oh.opcion_id, g.id, NULL::BIGINT, 1
  FROM oh CROSS JOIN galletas g WHERE oh.n = '1 dona + 1 galleta'
  UNION ALL
  -- «1 X» o «X» con producto de nombre igual a X (sin el «1 » inicial), x1
  SELECT oh.opcion_id, p.id, NULL::BIGINT, 1
  FROM oh
  JOIN producto p ON lower(trim(p.nombre)) = CASE WHEN oh.n LIKE '1 %' THEN trim(substring(oh.n FROM 3)) ELSE oh.n END
  WHERE oh.n NOT IN ('2 donas', '2 galletas choco chips', '1 dona + 1 galleta')
    AND oh.grupo_n NOT LIKE 'dona%sabor%'
  UNION ALL
  -- Sabores de «Dona N · Sabor»: el sabor de DONAS ARTESANALES con el mismo nombre, x1
  SELECT oh.opcion_id, d.id, s.id, 1
  FROM oh
  CROSS JOIN donas d
  JOIN sabor s ON s.producto_id = d.id AND lower(trim(s.nombre)) = oh.n
  WHERE oh.grupo_n LIKE 'dona%sabor%'
)
INSERT INTO "opcion_requiere" ("opcion_id", "producto_id", "sabor_id", "cantidad")
SELECT DISTINCT r.opcion_id, r.producto_id, r.sabor_id, r.cantidad FROM req r
ON CONFLICT DO NOTHING;
