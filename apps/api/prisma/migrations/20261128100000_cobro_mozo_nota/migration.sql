-- Cobro por mozo: efectivo recibido; nota de venta anulable (se conserva la anulada y el pedido puede tener una nueva vigente).
-- Operativa: no aplicar a bases sin revisar. El índice parcial no lo expresa Prisma en el schema.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "cobro_mozo_recibido" DECIMAL(12,2);
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "anulado_en" TIMESTAMP(3);
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "anulado_motivo" TEXT;
DROP INDEX IF EXISTS "comprobante_pedido_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "comprobante_pedido_vigente_key" ON "comprobante"("pedido_id") WHERE "anulado_en" IS NULL;
