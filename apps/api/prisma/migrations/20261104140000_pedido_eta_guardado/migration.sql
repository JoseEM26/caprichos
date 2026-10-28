-- Tiempo que se le prometió al cliente al salir con el repartidor (aditivo, sin datos personales).
-- El seguimiento cuenta desde la salida con este rango; pedidos anteriores quedan en NULL y usan tiempo_prometido_min.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "eta_min" INTEGER;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "eta_max" INTEGER;
