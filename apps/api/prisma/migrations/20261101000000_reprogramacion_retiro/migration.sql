-- Reprogramación tras el retiro de la movilidad: la pregunta SI/NO (etapa 5), el reenvío (10) y los cierres (11-13).
-- Amplía las etapas de mensaje_reparto de 1-9 a 1-13 y siembra los dos parámetros nuevos. Idempotente.

ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_numero";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 13);

INSERT INTO "parametro" ("clave", "valor") VALUES
  ('reprog_respuesta_min', '30'::jsonb),
  ('reprog_max_intentos', '1'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
