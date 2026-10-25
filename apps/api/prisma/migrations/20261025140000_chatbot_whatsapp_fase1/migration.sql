-- CreateTable
CREATE TABLE "whatsapp_mensaje" (
    "id" BIGSERIAL NOT NULL,
    "direccion" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "telefono_enmascarado" TEXT NOT NULL,
    "telefono_hash" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "plantilla" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ENCOLADO',
    "error_codigo" TEXT,
    "error_detalle" TEXT,
    "pedido_id" BIGINT,
    "conversacion_id" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_whatsapp_consentimiento" (
    "id" BIGSERIAL NOT NULL,
    "telefono_hash" TEXT NOT NULL,
    "acepta" BOOLEAN NOT NULL DEFAULT true,
    "origen" TEXT NOT NULL DEFAULT 'WEBHOOK_BAJA',
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_whatsapp_consentimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encuesta_posventa" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "enviada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_en" TIMESTAMPTZ,
    "puntaje" SMALLINT,
    "comentario" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ENVIADA',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encuesta_posventa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queja_whatsapp" (
    "id" BIGSERIAL NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'ENCUESTA',
    "pedido_id" BIGINT,
    "cliente" TEXT NOT NULL,
    "telefono_hash" TEXT,
    "puntaje" SMALLINT,
    "texto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NUEVA',
    "atendida_por" TEXT,
    "resolucion" TEXT,
    "creada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queja_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_mensaje_wa_message_id_key" ON "whatsapp_mensaje"("wa_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_mensaje_telefono_hash_idx" ON "whatsapp_mensaje"("telefono_hash");

-- CreateIndex
CREATE INDEX "whatsapp_mensaje_creado_en_idx" ON "whatsapp_mensaje"("creado_en");

-- CreateIndex
CREATE INDEX "whatsapp_mensaje_pedido_id_idx" ON "whatsapp_mensaje"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_whatsapp_consentimiento_telefono_hash_key" ON "cliente_whatsapp_consentimiento"("telefono_hash");

-- CreateIndex
CREATE UNIQUE INDEX "encuesta_posventa_pedido_id_key" ON "encuesta_posventa"("pedido_id");

-- CreateIndex
CREATE INDEX "queja_whatsapp_estado_idx" ON "queja_whatsapp"("estado");

-- CreateIndex
CREATE INDEX "queja_whatsapp_pedido_id_idx" ON "queja_whatsapp"("pedido_id");

-- AddForeignKey
ALTER TABLE "whatsapp_mensaje" ADD CONSTRAINT "whatsapp_mensaje_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_mensaje" ADD CONSTRAINT "whatsapp_mensaje_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encuesta_posventa" ADD CONSTRAINT "encuesta_posventa_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queja_whatsapp" ADD CONSTRAINT "queja_whatsapp_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
