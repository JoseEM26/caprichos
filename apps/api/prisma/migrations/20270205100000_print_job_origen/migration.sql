-- Historial de impresiones: de dónde nació cada trabajo y quién lo pidió. Aditiva e idempotente: no toca filas existentes
-- (quedan en NULL y el origen se deduce al leer: copia → REIMPRESION, prueba sin pedido → PRUEBA, lo demás → AUTOMATICA).
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "origen" TEXT;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "solicitado_por_party_id" BIGINT;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "motivo_origen" TEXT;
CREATE INDEX IF NOT EXISTS "print_job_creado_en_idx" ON "print_job" ("creado_en" DESC);
