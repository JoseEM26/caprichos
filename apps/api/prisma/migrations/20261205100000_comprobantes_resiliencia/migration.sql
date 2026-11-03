-- Que no se pierda nada: próximo intento, lease de envío y cola de fallos (REVISION_MANUAL) en comprobante.
-- Nada se borra. Idempotente (IF NOT EXISTS).
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "proximo_intento_en" TIMESTAMPTZ;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "enviando_hasta" TIMESTAMPTZ;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "revision_motivo" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "revision_en" TIMESTAMPTZ;
