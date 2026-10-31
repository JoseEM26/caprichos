-- Reparto: numero fijo de la parada dentro de la ruta (lo que ve el repartidor); orden_ruta sigue siendo el orden obligatorio. Operativa: no migra a produccion.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "numero_ruta" INTEGER;
