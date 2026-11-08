-- Chats «Atendido»: cuándo y quién los archivó (el bot los retoma a las 00:01 de Lima). Aditiva e idempotente.
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "atendido_en" TIMESTAMPTZ;
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "atendido_por" BIGINT;
CREATE INDEX IF NOT EXISTS "conversacion_atendido_en_idx" ON "conversacion"("atendido_en");
