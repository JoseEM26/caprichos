-- Modo del recargo por reprogramar tras el retiro: IGUAL_ENVIO (por defecto), FIJO o SIN_COSTO.
-- FIJO usa reparto_recargo_reprogramacion. Idempotente.

INSERT INTO "parametro" ("clave", "valor") VALUES
  ('reprog_recargo_modo', '"IGUAL_ENVIO"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
