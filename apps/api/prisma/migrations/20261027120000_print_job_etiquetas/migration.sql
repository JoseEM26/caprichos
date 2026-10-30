-- AlterTable print_job
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "clave_idempotencia" TEXT;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "copia" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "tomado_en" TIMESTAMPTZ;
ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "device_key_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "print_job_clave_idempotencia_key" ON "print_job"("clave_idempotencia");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'print_job_device_key_id_fkey'
    ) THEN
        ALTER TABLE "print_job" ADD CONSTRAINT "print_job_device_key_id_fkey" FOREIGN KEY ("device_key_id") REFERENCES "device_key"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable device_key
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "ultimo_latido" TIMESTAMPTZ;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_version" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_impresora" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_detalle" TEXT;
