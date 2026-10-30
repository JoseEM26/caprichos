-- Reemplazo de vouchers sin borrar nada (aditivo). reemplazado_en NULL = voucher vigente (las filas antiguas quedan vigentes).
ALTER TABLE "voucher_pago"
  ADD COLUMN "reemplazado_en" TIMESTAMPTZ,
  ADD COLUMN "reemplazado_por" BIGINT,
  ADD COLUMN "motivo_cambio" TEXT,
  ADD COLUMN "reemplaza_a" BIGINT;

-- CreateIndex
CREATE INDEX "voucher_pago_reemplazado_en_idx" ON "voucher_pago"("reemplazado_en");

-- AddForeignKey
ALTER TABLE "voucher_pago" ADD CONSTRAINT "voucher_pago_reemplazado_por_fkey" FOREIGN KEY ("reemplazado_por") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_pago" ADD CONSTRAINT "voucher_pago_reemplaza_a_fkey" FOREIGN KEY ("reemplaza_a") REFERENCES "voucher_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
