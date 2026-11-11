-- Consumos del personal: a qué planilla pertenece su cobro. Aditiva e idempotente.
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "planilla_periodo_id" BIGINT;
CREATE INDEX IF NOT EXISTS "consumo_personal_planilla_periodo_id_idx" ON "consumo_personal"("planilla_periodo_id");

-- Regulariza las planillas ya pagadas: enlaza los consumos que cobraron (ids congelados en el detalle).
UPDATE "consumo_personal" c
SET "planilla_periodo_id" = p."id"
FROM "planilla_periodo" p, LATERAL jsonb_array_elements_text(COALESCE(p."detalle"::jsonb -> 'consumosCobradosIds', '[]'::jsonb)) AS x(cid)
WHERE p."estado" = 'PAGADO'
  AND c."id" = x.cid::bigint
  AND c."planilla_periodo_id" IS NULL
  AND c."pago_modo" = 'PLANILLA';
