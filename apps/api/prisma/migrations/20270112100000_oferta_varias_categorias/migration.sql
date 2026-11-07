-- Un descuento puede aplicar solo a varias categorias. alcance_categoria_id se conserva (primera categoria) por compatibilidad.
-- Aditiva e idempotente: los descuentos de una sola categoria pasan a la lista y siguen aplicando igual.
ALTER TABLE "oferta" ADD COLUMN IF NOT EXISTS "alcance_categoria_ids" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[];
UPDATE "oferta" SET "alcance_categoria_ids" = ARRAY["alcance_categoria_id"]
 WHERE "alcance_categoria_id" IS NOT NULL AND cardinality("alcance_categoria_ids") = 0;
