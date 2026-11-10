-- CUPOS POR PRODUCTO EN LAS PARTES A ELECCION DEL COMBO (aditiva e idempotente; NULL = cada producto ocupa 1 lugar)
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "cupos_producto" JSONB;
