-- Pedidos programados (Caja y mozo): fecha y hora pactadas, estado PROGRAMADO y adelantos de dinero que
-- cuentan en la caja del día en que entran. Aditiva e idempotente.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "programado_para" TIMESTAMPTZ;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "adelanto_total" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_estado;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_estado CHECK (estado IN ('PROGRAMADO','COLA','PREPARANDO','POR_CONFIRMAR','EN_COCINA','LISTO','EN_CAMINO','ENTREGADO','EN_COORDINACION','COBRADO','RECHAZADO','ANULADO'));
ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_adelanto;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_adelanto CHECK ("adelanto_total" >= 0);

CREATE INDEX IF NOT EXISTS "pedido_programado_para_idx" ON "pedido" ("programado_para") WHERE "estado" = 'PROGRAMADO';

CREATE TABLE IF NOT EXISTS "pedido_adelanto" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "caja_id" BIGINT NOT NULL,
    "medio" VARCHAR(20) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "recibido" DECIMAL(12,2),
    "vuelto" DECIMAL(12,2),
    "por_party_id" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "motivo_anulacion" TEXT,
    CONSTRAINT "pedido_adelanto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_pedido_adelanto_monto" CHECK ("monto" > 0),
    CONSTRAINT "ck_pedido_adelanto_medio" CHECK ("medio" IN ('EFECTIVO','TARJETA')),
    CONSTRAINT "pedido_adelanto_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedido_adelanto_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "pedido_adelanto_caja_id_idx" ON "pedido_adelanto" ("caja_id");
CREATE INDEX IF NOT EXISTS "pedido_adelanto_pedido_id_idx" ON "pedido_adelanto" ("pedido_id");
