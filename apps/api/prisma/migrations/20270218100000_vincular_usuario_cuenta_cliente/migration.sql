-- Vínculo explícito y reversible entre una cuenta de cliente y el usuario del panel (trabajador) de la misma persona.
-- Aditiva e idempotente. Solo da descuento de personal en la carta; no mueve datos ni da permisos.
ALTER TABLE "customer_account" ADD COLUMN IF NOT EXISTS "usuario_party_id" BIGINT;
-- Un usuario tiene a lo sumo una cuenta de cliente vinculada.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_account_usuario_party_id_key" ON "customer_account"("usuario_party_id") WHERE "usuario_party_id" IS NOT NULL;
