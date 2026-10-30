-- Parametros del outbox de WhatsApp (aditivo, idempotente).
-- outbox_max_intentos: intentos de envio antes de dejar el mensaje FALLIDO.
-- outbox_retencion_dias: dias que se conservan los ENVIADO.
-- outbox_retencion_fallidos_dias: dias que se conservan los DESCARTADO (dead letter descartado).
-- outbox_alerta_fallidos: avisa a Caja y Admin (campana) cuando un mensaje queda FALLIDO.
-- outbox_lag_alerta_min: minutos de retraso del mensaje PENDIENTE mas viejo antes de la alerta de lag.
-- ON CONFLICT DO NOTHING: no pisa lo que el dueño ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('outbox_max_intentos', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('outbox_retencion_dias', '30'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('outbox_retencion_fallidos_dias', '90'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('outbox_alerta_fallidos', '"si"'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('outbox_lag_alerta_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
