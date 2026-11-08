-- Parte de combo opcional: el cliente puede quitarla o pedir extras (cobro por unidad adicional). Todo con valores que no cambian lo existente.
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "opcional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "cantidad_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "cantidad_max" INTEGER;
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "incluida_por_defecto" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "precio_extra" DECIMAL(12,2);
