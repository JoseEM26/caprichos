-- Adelanto de pedido programado con cualquier medio (captura opcional) y devolución con egreso de la caja de hoy. Aditiva e idempotente.
ALTER TABLE "pedido_adelanto" DROP CONSTRAINT IF EXISTS "ck_pedido_adelanto_medio";
ALTER TABLE "pedido_adelanto" ADD CONSTRAINT "ck_pedido_adelanto_medio" CHECK ("medio" IN ('EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA'));
ALTER TABLE "pedido_adelanto" ADD COLUMN IF NOT EXISTS "devuelto_movimiento_id" BIGINT;
ALTER TABLE "pedido_adelanto" ADD COLUMN IF NOT EXISTS "devuelto_en_caja_id" BIGINT;
