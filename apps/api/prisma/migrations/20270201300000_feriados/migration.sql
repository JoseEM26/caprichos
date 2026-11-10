-- FERIADOS (aditiva e idempotente)
-- Tabla feriado: fecha única, nombre, recargo (multiplicador del valor hora, defecto 2) y activo. Nunca se borra: se desactiva.
-- Precargada con los feriados nacionales de Perú 2026 y 2027 (el ADMIN los edita desde Asistencia › Feriados).

CREATE TABLE IF NOT EXISTS "feriado" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "recargo" DECIMAL(4,2) NOT NULL DEFAULT 2,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_por" BIGINT,
    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feriado_recargo_check" CHECK ("recargo" >= 1 AND "recargo" <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "feriado_fecha_key" ON "feriado" ("fecha");

INSERT INTO "feriado" ("fecha", "nombre") VALUES
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-06-07', 'Día de la Bandera y Batalla de Arica'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2026-07-28', 'Fiestas Patrias'),
  ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-06', 'Batalla de Junín'),
  ('2026-08-30', 'Santa Rosa de Lima'),
  ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-09', 'Batalla de Ayacucho'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-06-07', 'Día de la Bandera y Batalla de Arica'),
  ('2027-06-29', 'San Pedro y San Pablo'),
  ('2027-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2027-07-28', 'Fiestas Patrias'),
  ('2027-07-29', 'Fiestas Patrias'),
  ('2027-08-06', 'Batalla de Junín'),
  ('2027-08-30', 'Santa Rosa de Lima'),
  ('2027-10-08', 'Combate de Angamos'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-09', 'Batalla de Ayacucho'),
  ('2027-12-25', 'Navidad')
ON CONFLICT ("fecha") DO NOTHING;
