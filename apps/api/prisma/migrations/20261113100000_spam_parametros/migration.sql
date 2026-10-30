-- Parametros de proteccion contra spam y pedidos falsos (aditivo, idempotente).
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('spam_bloqueo_excesos', '3'::jsonb),
  ('spam_bloqueo_min', '60'::jsonb),
  ('spam_bloqueo_reincidente_min', '1440'::jsonb),
  ('whatsapp_max_pedidos_sin_pagar', '3'::jsonb),
  ('chatbot_antispam_max_minuto', '10'::jsonb),
  ('chatbot_antispam_max_hora', '60'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
