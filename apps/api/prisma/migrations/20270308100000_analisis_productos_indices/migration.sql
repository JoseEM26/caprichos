-- Análisis › Productos agrupa líneas y opciones de pedido por rango de fechas: sin estos índices recorre las tablas enteras.
CREATE INDEX IF NOT EXISTS "pedido_linea_pedido_id_idx" ON "pedido_linea"("pedido_id");
CREATE INDEX IF NOT EXISTS "pedido_linea_opcion_pedido_linea_id_idx" ON "pedido_linea_opcion"("pedido_linea_id");
