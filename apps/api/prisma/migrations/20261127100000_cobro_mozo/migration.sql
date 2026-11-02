-- Cobro por mozo: el pedido queda marcado cuando el mozo lo envía a Caja (medio, hora y mozo). Operativa: no aplicar a bases sin revisar.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "cobro_mozo_en" TIMESTAMP(3);
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "cobro_mozo_medio" TEXT;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "cobro_mozo_party_id" BIGINT;
