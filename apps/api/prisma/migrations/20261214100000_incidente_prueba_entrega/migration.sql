-- Prueba de entrega fallida (cliente no salió): llegada, minutos de espera y repartidor en el incidente
ALTER TABLE "incidente_entrega" ADD COLUMN IF NOT EXISTS "llego_en" TIMESTAMPTZ;
ALTER TABLE "incidente_entrega" ADD COLUMN IF NOT EXISTS "espera_max_min" INTEGER;
ALTER TABLE "incidente_entrega" ADD COLUMN IF NOT EXISTS "repartidor_party_id" BIGINT;

-- Fotos del lugar (1 a 3) de la prueba de entrega, privadas
CREATE TABLE IF NOT EXISTS "incidente_entrega_foto" (
    "incidente_id" BIGINT NOT NULL,
    "archivo_id" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidente_entrega_foto_pkey" PRIMARY KEY ("incidente_id", "archivo_id"),
    CONSTRAINT "incidente_entrega_foto_incidente_id_fkey" FOREIGN KEY ("incidente_id") REFERENCES "incidente_entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "incidente_entrega_foto_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
