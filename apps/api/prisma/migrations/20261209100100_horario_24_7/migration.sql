-- Horario 24/7 de la persona: si nadie con la casilla de correo está de turno, el aviso va a estos usuarios.
-- Aditivo e idempotente. Los ADMIN existentes lo tienen por defecto (se puede quitar).
ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "horario_24_7" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "person" SET "horario_24_7" = TRUE
WHERE "party_id" IN (SELECT "party_id" FROM "user_account" WHERE "rol" = 'ADMIN') AND "horario_24_7" = FALSE;
