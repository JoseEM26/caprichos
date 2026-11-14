-- La migración original de propinas dejó la carta y el bot APAGADOS (el código dice «encendida por defecto»):
-- por eso el cliente no veía dónde poner propina. Decisión del dueño (14/11/2026): propina encendida en la
-- carta virtual y en el bot de WhatsApp. Se encienden esas dos claves sin tocar las demás (mozo, caja).
INSERT INTO "parametro" ("clave", "valor")
VALUES ('propina_activa', '{"carta": true, "bot": true}'::jsonb)
ON CONFLICT ("clave") DO UPDATE
SET "valor" = COALESCE("parametro"."valor", '{}'::jsonb) || '{"carta": true, "bot": true}'::jsonb;
