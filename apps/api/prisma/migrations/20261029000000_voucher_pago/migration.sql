-- CreateTable
CREATE TABLE "voucher_pago" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT,
    "conversacion_id" BIGINT,
    "mensaje_id" BIGINT,
    "archivo_id" BIGINT NOT NULL,
    "origen" TEXT NOT NULL,
    "medio" TEXT,
    "subido_por" BIGINT,
    "hash_imagen" TEXT,
    "operacion" TEXT,
    "extraido" JSONB,
    "semaforo" TEXT NOT NULL,
    "motivos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "revisado_en" TIMESTAMPTZ,
    "revisado_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voucher_pago_pedido_id_idx" ON "voucher_pago"("pedido_id");

-- CreateIndex
CREATE INDEX "voucher_pago_conversacion_id_idx" ON "voucher_pago"("conversacion_id");

-- CreateIndex
CREATE INDEX "voucher_pago_operacion_idx" ON "voucher_pago"("operacion");

-- CreateIndex
CREATE INDEX "voucher_pago_creado_en_idx" ON "voucher_pago"("creado_en");

-- CreateIndex
CREATE INDEX "voucher_pago_hash_imagen_idx" ON "voucher_pago"("hash_imagen");

-- AddForeignKey
ALTER TABLE "voucher_pago" ADD CONSTRAINT "voucher_pago_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_pago" ADD CONSTRAINT "voucher_pago_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_pago" ADD CONSTRAINT "voucher_pago_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Semillas de configuracion (tabla parametro)
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_ia_activo', 'false'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_titular_nombre', '"Maria Jose Morillo Ruiz"'::jsonb) ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_yape_numero', '"977503006"'::jsonb) ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_plin_numero', '"977503006"'::jsonb) ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_mozo_obligatorio', 'true'::jsonb) ON CONFLICT ("clave") DO NOTHING;
