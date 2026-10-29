-- Direcciones de delivery guardadas por cliente con cuenta (aditivo, expand).
-- cliente_party_id: cliente con cuenta identificado en el pedido (carta, WhatsApp o DNI del mozo). NULL = invitado.
-- cliente_direccion: nunca se borra; se desactiva (activo = false).

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN "cliente_party_id" BIGINT;

-- CreateTable
CREATE TABLE "cliente_direccion" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "zona_id" BIGINT,
    "origen" TEXT NOT NULL,
    "alias" TEXT,
    "usos" INTEGER NOT NULL DEFAULT 1,
    "ultimo_uso_en" TIMESTAMPTZ NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_direccion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_cliente_direccion_origen" CHECK ("origen" IN ('CARTA','MOZO','WHATSAPP','MAPA','ESCRITA')),
    CONSTRAINT "ck_cliente_direccion_usos" CHECK ("usos" > 0)
);

-- CreateIndex
CREATE INDEX "pedido_cliente_party_id_idx" ON "pedido"("cliente_party_id");

-- CreateIndex
CREATE INDEX "cliente_direccion_party_activo_uso_idx" ON "cliente_direccion"("party_id", "activo", "ultimo_uso_en" DESC);

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cliente_party_id_fkey" FOREIGN KEY ("cliente_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_direccion" ADD CONSTRAINT "cliente_direccion_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_direccion" ADD CONSTRAINT "cliente_direccion_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zona_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
