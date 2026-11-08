-- Estado de pago del consumo del personal: pendiente (cuenta semanal/mensual) o saldado en Caja / por planilla.
-- Idempotente. Los consumos que ya existen quedan pendientes (pagado_en NULL).
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "pagado_en" TIMESTAMPTZ;
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "pagado_por" BIGINT;
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "pago_modo" TEXT;
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "pago_medio" TEXT;
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "pago_motivo" TEXT;
ALTER TABLE "consumo_personal" ADD COLUMN IF NOT EXISTS "movimiento_caja_id" BIGINT;
