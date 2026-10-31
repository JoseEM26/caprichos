-- Reparto: orden de la ruta que elige el repartidor al tomar sus pedidos (1 = primera parada). Nulo = sin orden elegido.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "orden_ruta" INTEGER;
