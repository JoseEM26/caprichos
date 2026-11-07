-- Pantalla Despacho: marca de «atendido» por pedido (quién y cuándo). Idempotente.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "atendido_despacho_en" TIMESTAMPTZ;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "atendido_despacho_por" BIGINT;
