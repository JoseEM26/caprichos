-- «No corresponde devolver» (14/11/2026): un pedido cancelado por no recibir que estaba pagado sale de la lista de
-- devoluciones pendientes sin mover dinero (p. ej. la caja ya cuadró o al final sí se entregó). Solo ADMIN/SUPERVISOR,
-- con motivo y auditoría.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "devolucion_descartada_en" TIMESTAMPTZ;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "devolucion_descartada_por" BIGINT;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "devolucion_descartada_motivo" TEXT;
