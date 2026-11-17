-- Descuentos y bonos personalizados del personal (RRHH): se reutiliza descuento_recurrente_personal.
-- Aditiva y compatible: las filas existentes quedan como DESCUENTO, monto fijo, sin fecha de fin.
-- Reversión (manual, sin pérdida de las filas antiguas):
--   ALTER TABLE "descuento_recurrente_personal" DROP COLUMN "signo", DROP COLUMN "valor_tipo", DROP COLUMN "hasta";
--   (y volver el CHECK de periodicidad a ('SEMANAL','MENSUAL'); antes borrar las filas con periodicidad 'UNICA')
ALTER TABLE "descuento_recurrente_personal" ADD COLUMN "signo" VARCHAR(9) NOT NULL DEFAULT 'DESCUENTO';
ALTER TABLE "descuento_recurrente_personal" ADD COLUMN "valor_tipo" VARCHAR(10) NOT NULL DEFAULT 'MONTO';
ALTER TABLE "descuento_recurrente_personal" ADD COLUMN "hasta" DATE;
ALTER TABLE "descuento_recurrente_personal" ADD CONSTRAINT "descuento_recurrente_personal_signo_check" CHECK ("signo" IN ('DESCUENTO', 'BONO'));
ALTER TABLE "descuento_recurrente_personal" ADD CONSTRAINT "descuento_recurrente_personal_valor_tipo_check" CHECK ("valor_tipo" IN ('MONTO', 'PORCENTAJE'));
ALTER TABLE "descuento_recurrente_personal" DROP CONSTRAINT IF EXISTS "descuento_recurrente_personal_periodicidad_check";
ALTER TABLE "descuento_recurrente_personal" ADD CONSTRAINT "descuento_recurrente_personal_periodicidad_check" CHECK ("periodicidad" IN ('SEMANAL', 'MENSUAL', 'UNICA'));
