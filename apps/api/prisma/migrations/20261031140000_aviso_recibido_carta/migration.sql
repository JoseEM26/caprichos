-- Aviso "pedido recibido" al cliente que pide desde la carta virtual con celular (cualquier modalidad).
-- Amplía las etapas de mensaje_reparto de 1-8 a 1-9 (9 = RECIBIDO) y siembra su parámetro de activación.
ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_numero";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 9);

INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_recibido_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
