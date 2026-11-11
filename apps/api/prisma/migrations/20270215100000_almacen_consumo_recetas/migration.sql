-- Consumo de insumos por receta desde Cocina, pendientes de emitir de Almacén, merma por insumo y receta por sabor.
-- Aditiva e idempotente.

-- Merma habitual del insumo (la receta guarda la cantidad neta)
ALTER TABLE "insumo" ADD COLUMN IF NOT EXISTS "merma_pct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Receta por sabor: sabor_id vacío = receta general
ALTER TABLE "receta" ADD COLUMN IF NOT EXISTS "sabor_id" BIGINT;
DO $$ BEGIN
  ALTER TABLE "receta" ADD CONSTRAINT "receta_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP INDEX IF EXISTS "receta_producto_id_tamano_valor_id_es_produccion_key";
CREATE UNIQUE INDEX IF NOT EXISTS "receta_producto_id_tamano_valor_id_es_produccion_sabor_id_key"
  ON "receta"("producto_id", "tamano_valor_id", "es_produccion", "sabor_id");
-- La general (sin sabor) sigue siendo única como hasta hoy (en la clave de 4 columnas NULL cuenta como distinto)
CREATE UNIQUE INDEX IF NOT EXISTS "receta_general_unica_idx"
  ON "receta"("producto_id", "tamano_valor_id", "es_produccion") WHERE "sabor_id" IS NULL;

-- Trazabilidad del consumo por línea de pedido
ALTER TABLE "movimiento_stock" ADD COLUMN IF NOT EXISTS "pedido_linea_id" BIGINT;
CREATE INDEX IF NOT EXISTS "movimiento_stock_pedido_linea_id_idx" ON "movimiento_stock"("pedido_linea_id");
ALTER TABLE "movimiento_stock" DROP CONSTRAINT IF EXISTS "ck_movimiento_stock_tipo";
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "ck_movimiento_stock_tipo" CHECK ("tipo" IN (
    'ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'DEVOLUCION', 'VENTA',
    'PRODUCCION_CONSUMO', 'PRODUCCION_ALTA', 'TRASLADO_SALIDA',
    'TRASLADO_ENTRADA', 'DIFERENCIA_CONTEO', 'ANULACION', 'CORTESIA', 'CONSUMO_RECETA'
));

CREATE TABLE IF NOT EXISTS "consumo_linea" (
    "pedido_linea_id" BIGINT NOT NULL,
    "unidades" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consumo_linea_pkey" PRIMARY KEY ("pedido_linea_id")
);

CREATE TABLE IF NOT EXISTS "pendiente_almacen" (
    "id" BIGSERIAL NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "lugar_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "emitido" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "ajustado" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "origen_tipo" TEXT NOT NULL,
    "pedido_id" BIGINT,
    "pedido_linea_id" BIGINT,
    "produccion_id" BIGINT,
    "traslado_id" BIGINT,
    "nota" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto_en" TIMESTAMPTZ,
    "resuelto_por" BIGINT,
    CONSTRAINT "pendiente_almacen_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pendiente_almacen_estado_insumo_id_idx" ON "pendiente_almacen"("estado", "insumo_id");
CREATE INDEX IF NOT EXISTS "pendiente_almacen_pedido_linea_id_idx" ON "pendiente_almacen"("pedido_linea_id");
CREATE INDEX IF NOT EXISTS "pendiente_almacen_produccion_id_idx" ON "pendiente_almacen"("produccion_id");

DO $$ BEGIN
  ALTER TABLE "pendiente_almacen" ADD CONSTRAINT "pendiente_almacen_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "pendiente_almacen" ADD CONSTRAINT "pendiente_almacen_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
