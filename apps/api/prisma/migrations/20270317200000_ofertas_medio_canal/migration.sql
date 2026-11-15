-- Promociones por medio de pago y canales separados (CARTA, CAJA, MOZO, BOT).

-- 1. Medios de pago con los que vale la oferta (vacío = cualquier medio)
ALTER TABLE "oferta" ADD COLUMN IF NOT EXISTS "medios_pago" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. ADMIN (caja y mozo juntos) se separa: el valor de fábrica pasa a CARTA, CAJA, MOZO y BOT
ALTER TABLE "oferta" ALTER COLUMN "canales" SET DEFAULT ARRAY['CARTA', 'CAJA', 'MOZO', 'BOT']::TEXT[];

ALTER TABLE "cupon" ALTER COLUMN "canales" SET DEFAULT ARRAY['CARTA', 'CAJA', 'MOZO', 'BOT']::TEXT[];

-- 3. Datos: toda oferta o cupón que valía en el local (ADMIN, LOCAL, CAJA o MOZO) queda con CAJA y MOZO, sin ADMIN ni LOCAL.
--    Idempotente: volver a correrla deja lo mismo.
UPDATE "oferta"
SET "canales" = ARRAY(
  SELECT DISTINCT c FROM unnest(array_remove(array_remove("canales", 'ADMIN'), 'LOCAL') || ARRAY['CAJA', 'MOZO']) AS c
)
WHERE "canales" && ARRAY['ADMIN', 'LOCAL', 'CAJA', 'MOZO']::TEXT[];

UPDATE "cupon"
SET "canales" = ARRAY(
  SELECT DISTINCT c FROM unnest(array_remove(array_remove("canales", 'ADMIN'), 'LOCAL') || ARRAY['CAJA', 'MOZO']) AS c
)
WHERE "canales" && ARRAY['ADMIN', 'LOCAL', 'CAJA', 'MOZO']::TEXT[];
