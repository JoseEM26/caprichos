-- CORTESÍAS (aditiva e idempotente)
--
-- La cortesía es una VENTA CON COSTO 0: no es merma. Se registra con su valor de lista para medir lo regalado.
-- 1. pedido_linea.es_cortesia: la línea sale a S/ 0 (precio_unit y subtotal en 0); su valor de lista va en cortesia.valor_lista.
-- 2. cortesia: una fila por cortesía. Dentro de un pedido (pedido_id + pedido_linea_id) o por separado
--    (pedido_id NULL; pedido_referencia_id = pedido al que corresponde, obligatorio).
-- 3. movimiento_stock: nuevo tipo CORTESIA para el descuento de stock de las cortesías por separado.
--
-- Idempotente: IF NOT EXISTS / DROP IF EXISTS en todo. Sin datos que migrar.

ALTER TABLE "pedido_linea" ADD COLUMN IF NOT EXISTS "es_cortesia" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "movimiento_stock" DROP CONSTRAINT IF EXISTS "ck_movimiento_stock_tipo";
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "ck_movimiento_stock_tipo" CHECK ("tipo" IN (
    'ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'DEVOLUCION', 'VENTA',
    'PRODUCCION_CONSUMO', 'PRODUCCION_ALTA', 'TRASLADO_SALIDA',
    'TRASLADO_ENTRADA', 'DIFERENCIA_CONTEO', 'ANULACION', 'CORTESIA'
));

CREATE TABLE IF NOT EXISTS "cortesia" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "sabor_id" BIGINT,
    "cantidad" INTEGER NOT NULL,
    "valor_lista" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "nota" TEXT,
    "pedido_id" BIGINT,
    "pedido_linea_id" BIGINT,
    "pedido_referencia_id" BIGINT,
    "dada_por_party_id" BIGINT NOT NULL,
    "autorizada_por_party_id" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cortesia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cortesia_cantidad_check" CHECK ("cantidad" > 0),
    CONSTRAINT "cortesia_valor_lista_check" CHECK ("valor_lista" >= 0),
    CONSTRAINT "cortesia_motivo_check" CHECK ("motivo" IN (
        'COMPENSACION_ERROR_DEMORA', 'CUMPLEANOS_CLIENTE_FRECUENTE', 'DEGUSTACION_PROMOCION', 'RECLAMO_CLIENTE', 'OTRO'
    )),
    CONSTRAINT "cortesia_otro_nota_check" CHECK ("motivo" <> 'OTRO' OR ("nota" IS NOT NULL AND length(btrim("nota")) > 0)),
    CONSTRAINT "cortesia_referencia_check" CHECK ("pedido_id" IS NOT NULL OR "pedido_referencia_id" IS NOT NULL),
    CONSTRAINT "cortesia_linea_check" CHECK ("pedido_linea_id" IS NULL OR "pedido_id" IS NOT NULL),
    CONSTRAINT "cortesia_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_sabor_id_fkey" FOREIGN KEY ("sabor_id") REFERENCES "sabor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_pedido_linea_id_fkey" FOREIGN KEY ("pedido_linea_id") REFERENCES "pedido_linea"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_pedido_referencia_id_fkey" FOREIGN KEY ("pedido_referencia_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_dada_por_party_id_fkey" FOREIGN KEY ("dada_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cortesia_autorizada_por_party_id_fkey" FOREIGN KEY ("autorizada_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "cortesia_pedido_linea_id_key" ON "cortesia"("pedido_linea_id") WHERE "pedido_linea_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "cortesia_creado_en_idx" ON "cortesia"("creado_en");
CREATE INDEX IF NOT EXISTS "cortesia_producto_id_idx" ON "cortesia"("producto_id");
CREATE INDEX IF NOT EXISTS "cortesia_pedido_id_idx" ON "cortesia"("pedido_id");
CREATE INDEX IF NOT EXISTS "cortesia_pedido_referencia_id_idx" ON "cortesia"("pedido_referencia_id");
