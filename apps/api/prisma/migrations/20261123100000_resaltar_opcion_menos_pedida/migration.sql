-- Cocina: check «Resaltar en cocina la opción menos pedida» por producto. Apagado por defecto (no cambia nada).
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "resaltar_opcion_menos_pedida" BOOLEAN NOT NULL DEFAULT false;
