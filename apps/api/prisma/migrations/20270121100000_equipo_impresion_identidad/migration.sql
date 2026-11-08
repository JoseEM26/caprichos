-- Identidad estable de la PC de impresión: reutilizar su configuración al volver a vincularla. Aditiva e idempotente.
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "equipo_uid" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "archivada_en" TIMESTAMPTZ;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "reemplazada_por" BIGINT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "distinta_confirmada" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "device_key_equipo_uid_idx" ON "device_key"("equipo_uid");
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "eliminada_en" TIMESTAMPTZ;
