-- Impresión por computadora: cada PC define qué imprime. Aditiva e idempotente.
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_ip_local" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_ip_publica" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_hostname" TEXT;
ALTER TABLE "device_key" ADD COLUMN IF NOT EXISTS "latido_sistema" TEXT;

ALTER TABLE "print_job" ADD COLUMN IF NOT EXISTS "destino_equipo_id" BIGINT;
CREATE INDEX IF NOT EXISTS "print_job_destino_equipo_id_estado_idx" ON "print_job"("destino_equipo_id", "estado");

CREATE TABLE IF NOT EXISTS "equipo_impresion_config" (
  "device_key_id" BIGINT NOT NULL,
  "configurado" BOOLEAN NOT NULL DEFAULT false,
  "pausado" BOOLEAN NOT NULL DEFAULT false,
  "ticketera" BOOLEAN NOT NULL DEFAULT false,
  "etiquetera" BOOLEAN NOT NULL DEFAULT false,
  "ticket_pago" BOOLEAN NOT NULL DEFAULT false,
  "comanda_salon" BOOLEAN NOT NULL DEFAULT false,
  "comanda_areas" JSONB NOT NULL DEFAULT '[]',
  "sticker_general" BOOLEAN NOT NULL DEFAULT false,
  "sticker_areas" JSONB NOT NULL DEFAULT '[]',
  "sticker_bebida_areas" JSONB NOT NULL DEFAULT '[]',
  "tamanos" JSONB NOT NULL DEFAULT '{}',
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actualizado_por" BIGINT,
  CONSTRAINT "equipo_impresion_config_pkey" PRIMARY KEY ("device_key_id")
);

DO $$ BEGIN
  ALTER TABLE "equipo_impresion_config"
    ADD CONSTRAINT "equipo_impresion_config_device_key_id_fkey"
    FOREIGN KEY ("device_key_id") REFERENCES "device_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
