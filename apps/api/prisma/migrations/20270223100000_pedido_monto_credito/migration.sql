-- Crédito del personal con delivery: parte del pedido (productos, ya con su descuento) que se carga al crédito del trabajador.
-- Lo que Caja/repartidor cobran es total - monto_credito (el envío, que se paga al contado). 0 en todo pedido normal. Aditiva e idempotente.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "monto_credito" DECIMAL(10,2) NOT NULL DEFAULT 0;
