-- Saludo grande de cumpleaños ya mostrado: una vez por usuario y día de Lima, en cualquier dispositivo. Aditiva e idempotente.
-- Solo guarda quién y qué día (nunca la fecha de nacimiento). No hace falta retención: como máximo una fila por usuario y por su cumpleaños al año.
CREATE TABLE IF NOT EXISTS "cumpleanos_saludo" (
  "usuario_party_id" BIGINT NOT NULL,
  "fecha" DATE NOT NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "cumpleanos_saludo_pkey" PRIMARY KEY ("usuario_party_id", "fecha")
);
