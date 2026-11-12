-- Encuesta de calificación posventa: la migración 20261209100000 la dejó apagada (decisión del 02/11/2026) y por eso
-- no salía tras las compras. El dueño ya tiene la plantilla caprichos_encuesta_posventa: se vuelve a encender.
-- Es un valor por defecto: el ADMIN puede apagarla en Configuración > Parámetros.
INSERT INTO "parametro" ("clave", "valor") VALUES ('whatsapp_aviso_encuesta_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = '"si"'::jsonb;

-- Parámetros nuevos: una encuesta por celular cada 7 días; solo entre las 9 y las 21 h (Lima).
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('encuesta_tope_dias', '7'::jsonb),
  ('encuesta_hora_desde', '9'::jsonb),
  ('encuesta_hora_hasta', '21'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- Motivo de las encuestas omitidas (estado OMITIDA)
ALTER TABLE "encuesta_posventa" ADD COLUMN IF NOT EXISTS "motivo" TEXT;
