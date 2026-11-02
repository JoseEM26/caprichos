-- Listo por producto y despacho por unidad (cocina). Columnas aditivas: los pedidos viejos quedan en 0 / NULL.
-- Operativa: no aplicar a bases sin revisar.
ALTER TABLE "pedido_linea" ADD COLUMN IF NOT EXISTS "listas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pedido_linea" ADD COLUMN IF NOT EXISTS "listo_en" TIMESTAMPTZ;
ALTER TABLE "pedido_linea" ADD COLUMN IF NOT EXISTS "despachadas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pedido_linea" ADD COLUMN IF NOT EXISTS "despachado_en" TIMESTAMPTZ;
