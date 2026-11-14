-- Cupones por medio de pago: vacío = cualquier medio (los cupones existentes no cambian).
ALTER TABLE "cupon" ADD COLUMN IF NOT EXISTS "medios_pago" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
