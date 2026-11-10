-- Préstamos al personal con interés simple mensual opcional. Aditiva e idempotente: las filas existentes quedan en 0 % (sin cambios).
ALTER TABLE "prestamo_personal" ADD COLUMN IF NOT EXISTS "interes_pct_mensual" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "prestamo_personal" ADD COLUMN IF NOT EXISTS "interes_monto" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Servicios extra (Netflix y similares): periodicidad SEMANAL o MENSUAL (antes solo SEMANAL). Las filas existentes siguen en SEMANAL.
ALTER TABLE "descuento_recurrente_personal" DROP CONSTRAINT IF EXISTS "descuento_recurrente_personal_periodicidad_check";
ALTER TABLE "descuento_recurrente_personal" ADD CONSTRAINT "descuento_recurrente_personal_periodicidad_check" CHECK ("periodicidad" IN ('SEMANAL', 'MENSUAL'));
