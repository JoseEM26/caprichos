-- Stock por sabor para productos terminados (donas, galletas).
-- Aditiva: columnas nuevas con default o nulas, tablas nuevas. Los productos sin sabores no cambian.

-- Unidades por tamaño: Unidad=1, 1/2 docena=6, Docena=12 (por nombre del valor de tamaño; otros nombres no se tocan).
ALTER TABLE "producto_tamano" ADD COLUMN IF NOT EXISTS "unidades" INTEGER NOT NULL DEFAULT 1;
UPDATE "producto_tamano" pt SET "unidades" = 1
  FROM "lista_valor" lv WHERE lv."id" = pt."tamano_valor_id" AND lv."nombre" = 'Unidad';
UPDATE "producto_tamano" pt SET "unidades" = 6
  FROM "lista_valor" lv WHERE lv."id" = pt."tamano_valor_id" AND lv."nombre" = '1/2 docena';
UPDATE "producto_tamano" pt SET "unidades" = 12
  FROM "lista_valor" lv WHERE lv."id" = pt."tamano_valor_id" AND lv."nombre" = 'Docena';

-- CreateTable: saldo por sabor
CREATE TABLE IF NOT EXISTS "stock_sabor" (
    "id" BIGSERIAL NOT NULL,
    "sabor_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_sabor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_sabor_sabor_id_key" ON "stock_sabor"("sabor_id");

-- Conteo de apertura por sabor (nulo = producto entero, como antes)
ALTER TABLE "conteo_apertura" ADD COLUMN IF NOT EXISTS "sabor_id" BIGINT;

-- La unicidad (fecha, producto_id) pasa a (fecha, producto_id, sabor_id), tratando el nulo como 0:
-- los productos sin sabor siguen con una sola fila por día; cada sabor, una por día.
DROP INDEX IF EXISTS "conteo_apertura_fecha_producto_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "conteo_apertura_fecha_producto_sabor_key"
  ON "conteo_apertura"("fecha", "producto_id", COALESCE("sabor_id", 0));

-- Movimientos de stock con sabor
ALTER TABLE "movimiento_stock" ADD COLUMN IF NOT EXISTS "sabor_id" BIGINT;

-- Sabores repartidos en cada línea de pedido
CREATE TABLE IF NOT EXISTS "pedido_linea_sabor" (
    "id" BIGSERIAL NOT NULL,
    "pedido_linea_id" BIGINT NOT NULL,
    "sabor_id" BIGINT,
    "sabor_nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "pedido_linea_sabor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_sabor_sabor_id_fkey') THEN
    ALTER TABLE "stock_sabor" ADD CONSTRAINT "stock_sabor_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conteo_apertura_sabor_id_fkey') THEN
    ALTER TABLE "conteo_apertura" ADD CONSTRAINT "conteo_apertura_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimiento_stock_sabor_id_fkey') THEN
    ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_linea_sabor_pedido_linea_id_fkey') THEN
    ALTER TABLE "pedido_linea_sabor" ADD CONSTRAINT "pedido_linea_sabor_pedido_linea_id_fkey" FOREIGN KEY ("pedido_linea_id") REFERENCES "pedido_linea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_linea_sabor_sabor_id_fkey') THEN
    ALTER TABLE "pedido_linea_sabor" ADD CONSTRAINT "pedido_linea_sabor_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
