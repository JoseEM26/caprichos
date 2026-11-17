-- Anular una cortesía por separado (devuelve el stock). Solo agrega columnas NULL: compatible con el código anterior.
-- Reversible: DROP INDEX "movimiento_stock_cortesia_id_idx"; ALTER TABLE "movimiento_stock" DROP COLUMN "cortesia_id";
--             ALTER TABLE "cortesia" DROP COLUMN "anulada_en", DROP COLUMN "anulada_por_party_id", DROP COLUMN "motivo_anulacion";
ALTER TABLE "cortesia" ADD COLUMN "anulada_en" TIMESTAMPTZ, ADD COLUMN "anulada_por_party_id" BIGINT, ADD COLUMN "motivo_anulacion" TEXT;
ALTER TABLE "movimiento_stock" ADD COLUMN "cortesia_id" BIGINT;
CREATE INDEX "movimiento_stock_cortesia_id_idx" ON "movimiento_stock"("cortesia_id");
