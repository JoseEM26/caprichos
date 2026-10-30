-- Outbox de mensajes salientes de WhatsApp (aditivo).
-- Cada aviso se encola en la misma transacción que el cambio de estado que lo origina y lo envía el planificador.
-- Los CHECK de tipo y estado van completos desde el inicio (incluye DESCARTADO: dead letter sin borrar).
CREATE TABLE IF NOT EXISTS "saliente_whatsapp" (
    "id" BIGSERIAL NOT NULL,
    "secuencia" BIGSERIAL NOT NULL,
    "telefono_destino" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "carga" JSONB NOT NULL DEFAULT '{}',
    "clave_idempotencia" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "max_intentos" INTEGER NOT NULL DEFAULT 5,
    "proximo_intento_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intento_token" TEXT,
    "ultimo_error" TEXT,
    "wa_message_id" TEXT,
    "pedido_id" BIGINT,
    "origen" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_en" TIMESTAMPTZ,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descartado_en" TIMESTAMPTZ,
    "descartado_por" TEXT,
    "motivo_descarte" TEXT,

    CONSTRAINT "saliente_whatsapp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_saliente_whatsapp_tipo" CHECK ("tipo" IN ('TEXTO', 'PLANTILLA')),
    CONSTRAINT "ck_saliente_whatsapp_estado" CHECK ("estado" IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO', 'DESCARTADO'))
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saliente_whatsapp_clave_idempotencia_key" ON "saliente_whatsapp"("clave_idempotencia");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saliente_whatsapp_secuencia_key" ON "saliente_whatsapp"("secuencia");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saliente_whatsapp_estado_proximo_intento_en_idx" ON "saliente_whatsapp"("estado", "proximo_intento_en");

-- CreateIndex (orden por destino y pedido)
CREATE INDEX IF NOT EXISTS "saliente_whatsapp_destino_pedido_idx" ON "saliente_whatsapp"("telefono_destino", "pedido_id", "secuencia");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'saliente_whatsapp_pedido_id_fkey'
    ) THEN
        ALTER TABLE "saliente_whatsapp" ADD CONSTRAINT "saliente_whatsapp_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
