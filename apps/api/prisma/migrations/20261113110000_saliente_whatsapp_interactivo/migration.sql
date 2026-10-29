-- Expand: el outbox acepta mensajes interactivos (botones y lista). Todos los valores del CHECK de tipo.
-- origen no tiene CHECK; estado no cambia.
ALTER TABLE "saliente_whatsapp" DROP CONSTRAINT IF EXISTS "ck_saliente_whatsapp_tipo";
ALTER TABLE "saliente_whatsapp"
  ADD CONSTRAINT "ck_saliente_whatsapp_tipo" CHECK ("tipo" IN ('TEXTO', 'PLANTILLA', 'INTERACTIVO'));
