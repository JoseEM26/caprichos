-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- CreateTable
CREATE TABLE "comanda_area" (
    "pedido_id" BIGINT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'EN_COCINA',
    "llego_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "despejada_en" TIMESTAMPTZ,
    "despejada_por" BIGINT,
    "devuelta_en" TIMESTAMPTZ,
    "devuelta_por" BIGINT,

    CONSTRAINT "comanda_area_pkey" PRIMARY KEY ("pedido_id","area_id")
);

-- CreateTable
CREATE TABLE "agotado" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT,
    "opcion_id" BIGINT,
    "sabor_id" BIGINT,
    "tipo" TEXT,
    "alcance" TEXT NOT NULL,
    "desde" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ,
    "reactivado_en" TIMESTAMPTZ,
    "por" BIGINT NOT NULL,

    CONSTRAINT "agotado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alta_demanda" (
    "id" BIGSERIAL NOT NULL,
    "minutos" INTEGER NOT NULL,
    "pausa" BOOLEAN NOT NULL DEFAULT false,
    "desde" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ,
    "por" BIGINT NOT NULL,
    "area_id" BIGINT,

    CONSTRAINT "alta_demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lugar_stock" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "area_id" BIGINT,

    CONSTRAINT "lugar_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumo" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad_compra" TEXT NOT NULL,
    "unidad_almacen" TEXT NOT NULL,
    "unidad_receta" TEXT NOT NULL,
    "factor_compra" DECIMAL(14,3) NOT NULL,
    "factor_receta" DECIMAL(14,6) NOT NULL,
    "minimo" DECIMAL(14,3) NOT NULL,
    "intermedio" DECIMAL(14,3),
    "maximo" DECIMAL(14,3) NOT NULL,
    "lugar_consumo_id" BIGINT,
    "costo_unit" DECIMAL(12,4),
    "proveedor_a" BIGINT,
    "proveedor_b" BIGINT,
    "proveedor_c" BIGINT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" BIGSERIAL NOT NULL,
    "insumo_id" BIGINT,
    "producto_id" BIGINT,
    "lugar_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_stock" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "insumo_id" BIGINT,
    "producto_id" BIGINT,
    "lugar_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "origen_valor_id" BIGINT,
    "destino_valor_id" BIGINT,
    "pedido_id" BIGINT,
    "produccion_id" BIGINT,
    "traslado_id" BIGINT,
    "compra_id" BIGINT,
    "nota" TEXT,
    "movimiento_anulado_id" BIGINT,
    "por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "tamano_valor_id" BIGINT,
    "es_produccion" BOOLEAN NOT NULL DEFAULT false,
    "rinde" DECIMAL(14,3),

    CONSTRAINT "receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_linea" (
    "receta_id" BIGINT NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "producto_tamano_id" BIGINT,

    CONSTRAINT "receta_linea_pkey" PRIMARY KEY ("receta_id","insumo_id")
);

-- CreateTable
CREATE TABLE "ajuste_opcion" (
    "opcion_id" BIGINT NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "efecto" TEXT NOT NULL,
    "reemplaza_insumo_id" BIGINT,
    "cantidad" DECIMAL(14,3),

    CONSTRAINT "ajuste_opcion_pkey" PRIMARY KEY ("opcion_id","insumo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lugar_stock_nombre_key" ON "lugar_stock"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "insumo_nombre_key" ON "insumo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "receta_producto_id_tamano_valor_id_es_produccion_key" ON "receta"("producto_id", "tamano_valor_id", "es_produccion");

-- AddForeignKey
ALTER TABLE "comanda_area" ADD CONSTRAINT "comanda_area_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda_area" ADD CONSTRAINT "comanda_area_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agotado" ADD CONSTRAINT "agotado_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agotado" ADD CONSTRAINT "agotado_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agotado" ADD CONSTRAINT "agotado_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alta_demanda" ADD CONSTRAINT "alta_demanda_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lugar_stock" ADD CONSTRAINT "lugar_stock_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_lugar_consumo_id_fkey" FOREIGN KEY ("lugar_consumo_id") REFERENCES "lugar_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_origen_valor_id_fkey" FOREIGN KEY ("origen_valor_id") REFERENCES "lista_valor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_destino_valor_id_fkey" FOREIGN KEY ("destino_valor_id") REFERENCES "lista_valor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_movimiento_anulado_id_fkey" FOREIGN KEY ("movimiento_anulado_id") REFERENCES "movimiento_stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta" ADD CONSTRAINT "receta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta" ADD CONSTRAINT "receta_tamano_valor_id_fkey" FOREIGN KEY ("tamano_valor_id") REFERENCES "lista_valor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_linea" ADD CONSTRAINT "receta_linea_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "receta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_linea" ADD CONSTRAINT "receta_linea_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_linea" ADD CONSTRAINT "receta_linea_producto_tamano_id_fkey" FOREIGN KEY ("producto_tamano_id") REFERENCES "producto_tamano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_opcion" ADD CONSTRAINT "ajuste_opcion_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_opcion" ADD CONSTRAINT "ajuste_opcion_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajuste_opcion" ADD CONSTRAINT "ajuste_opcion_reemplaza_insumo_id_fkey" FOREIGN KEY ("reemplaza_insumo_id") REFERENCES "insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones CHECK para tabla "comanda_area"
ALTER TABLE "comanda_area"
  ADD CONSTRAINT "ck_comanda_area_estado" CHECK ("estado" IN ('EN_COCINA', 'DESPEJADA'));

-- Restricciones CHECK para tabla "agotado"
ALTER TABLE "agotado"
  ADD CONSTRAINT "ck_agotado_alcance" CHECK ("alcance" IN ('HOY', 'INDEFINIDO', 'HASTA_REACTIVAR')),
  ADD CONSTRAINT "ck_agotado_entidad" CHECK (num_nonnulls("producto_id", "opcion_id", "sabor_id") = 1);

-- Restricciones CHECK para tabla "alta_demanda"
ALTER TABLE "alta_demanda"
  ADD CONSTRAINT "ck_alta_demanda_minutos" CHECK ("minutos" BETWEEN 5 AND 180);

-- Restricciones CHECK para tabla "lugar_stock"
ALTER TABLE "lugar_stock"
  ADD CONSTRAINT "ck_lugar_stock_tipo" CHECK ("tipo" IN ('ALMACEN', 'AREA'));

-- Restricciones CHECK para tabla "insumo"
ALTER TABLE "insumo"
  ADD CONSTRAINT "ck_insumo_proveedores" CHECK (
    ("proveedor_a" IS NULL OR "proveedor_b" IS NULL OR "proveedor_a" IS DISTINCT FROM "proveedor_b")
    AND ("proveedor_a" IS NULL OR "proveedor_c" IS NULL OR "proveedor_a" IS DISTINCT FROM "proveedor_c")
    AND ("proveedor_b" IS NULL OR "proveedor_c" IS NULL OR "proveedor_b" IS DISTINCT FROM "proveedor_c")
  );

-- Restricciones CHECK e índice único para tabla "stock"
ALTER TABLE "stock"
  ADD CONSTRAINT "ck_stock_item" CHECK (num_nonnulls("insumo_id", "producto_id") = 1);

CREATE UNIQUE INDEX "ux_stock" ON "stock" (COALESCE("insumo_id", 0), COALESCE("producto_id", 0), "lugar_id");

-- Restricciones CHECK para tabla "movimiento_stock"
ALTER TABLE "movimiento_stock"
  ADD CONSTRAINT "ck_movimiento_stock_tipo" CHECK ("tipo" IN (
    'ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'DEVOLUCION', 'VENTA',
    'PRODUCCION_CONSUMO', 'PRODUCCION_ALTA', 'TRASLADO_SALIDA',
    'TRASLADO_ENTRADA', 'DIFERENCIA_CONTEO', 'ANULACION'
  ));

-- Restricciones CHECK para tabla "ajuste_opcion"
ALTER TABLE "ajuste_opcion"
  ADD CONSTRAINT "ck_ajuste_opcion_efecto" CHECK ("efecto" IN ('SUMA', 'QUITA', 'REEMPLAZA'));

