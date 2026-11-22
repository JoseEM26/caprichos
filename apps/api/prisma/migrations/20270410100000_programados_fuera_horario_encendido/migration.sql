-- Decisión del dueño (22/11/2026): fuera de horario el bot y la carta dejan PROGRAMAR pedidos (llevar o delivery) para dentro del horario.
-- Para apagarlo: pedidos_programados_fuera_horario = "no".
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('pedidos_programados_fuera_horario', '"si"'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
