-- Lista de espera de mesa: pedido de mesa sin mesa asignada. Solo columnas nulas; no toca datos existentes. Idempotente.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "espera_mesa_desde" TIMESTAMPTZ;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "espera_personas" INTEGER;
CREATE INDEX IF NOT EXISTS "ix_pedido_espera_mesa" ON "pedido" ("espera_mesa_desde") WHERE "espera_mesa_desde" IS NOT NULL;
