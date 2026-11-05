-- Stock de productos terminados (donas, galletas) separado del interruptor «Control de almacén» (insumos).
-- Aditiva: columna con default false (los productos actuales no cambian) y tabla nueva de conteo de apertura.

-- AlterTable
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "controla_stock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "conteo_apertura" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "lugar_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteo_apertura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conteo_apertura_fecha_producto_id_key" ON "conteo_apertura"("fecha", "producto_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conteo_apertura_producto_id_fkey') THEN
    ALTER TABLE "conteo_apertura" ADD CONSTRAINT "conteo_apertura_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conteo_apertura_lugar_id_fkey') THEN
    ALTER TABLE "conteo_apertura" ADD CONSTRAINT "conteo_apertura_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
