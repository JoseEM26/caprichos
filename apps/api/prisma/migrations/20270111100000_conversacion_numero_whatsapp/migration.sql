-- Numero de WhatsApp Business que recibio al cliente: se responde desde el mismo (la ventana de 24 h es por numero).
-- Aditiva e idempotente.
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "phone_number_id" TEXT;
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "numero_receptor" TEXT;
