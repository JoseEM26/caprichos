-- «Bot que aprende cada noche» (solo venta y atención). Aditiva e idempotente.
-- Cada noche se leen los chats de ayer que atendió una persona (anonimizados en el servidor) y la IA propone respuestas;
-- solo el ADMIN las aprueba. Lo aprobado (conocimiento_bot) alimenta la IA de dudas. Nunca guarda datos personales:
-- las pruebas (evidencia) son extractos ya anonimizados de 300 caracteres como máximo.

CREATE TABLE IF NOT EXISTS "aprendizaje_noche" (
  "id" BIGSERIAL NOT NULL,
  "fecha" DATE NOT NULL,
  "estado" VARCHAR(12) NOT NULL DEFAULT 'EN_CURSO',
  "chats_leidos" INTEGER NOT NULL DEFAULT 0,
  "descartados_fuera_tema" INTEGER NOT NULL DEFAULT 0,
  "propuestas" INTEGER NOT NULL DEFAULT 0,
  "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
  "tokens_salida" INTEGER NOT NULL DEFAULT 0,
  "usd_estimado" NUMERIC(10,4) NOT NULL DEFAULT 0,
  "error" TEXT,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "terminado_en" TIMESTAMPTZ,
  CONSTRAINT "aprendizaje_noche_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "aprendizaje_noche_fecha_key" ON "aprendizaje_noche" ("fecha");

CREATE TABLE IF NOT EXISTS "aprendizaje_propuesto" (
  "id" BIGSERIAL NOT NULL,
  "noche_id" BIGINT NOT NULL,
  "tipo" VARCHAR(8) NOT NULL,
  "intencion" VARCHAR(80) NOT NULL,
  "pregunta" TEXT NOT NULL,
  "respuesta" TEXT NOT NULL,
  "frases" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "repeticiones" INTEGER NOT NULL DEFAULT 1,
  "evidencia" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "estado" VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
  "decidido_por" BIGINT,
  "decidido_en" TIMESTAMPTZ,
  "motivo" TEXT,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "aprendizaje_propuesto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "aprendizaje_propuesto_estado_idx" ON "aprendizaje_propuesto" ("estado", "creado_en");
CREATE INDEX IF NOT EXISTS "aprendizaje_propuesto_noche_idx" ON "aprendizaje_propuesto" ("noche_id");

CREATE TABLE IF NOT EXISTS "conocimiento_bot" (
  "id" BIGSERIAL NOT NULL,
  "version" INTEGER NOT NULL,
  "tipo" VARCHAR(8) NOT NULL,
  "intencion" VARCHAR(80) NOT NULL,
  "pregunta" TEXT NOT NULL,
  "respuesta" TEXT NOT NULL,
  "frases" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "estado" VARCHAR(10) NOT NULL DEFAULT 'VIGENTE',
  "aprendizaje_id" BIGINT,
  "aprobado_por" BIGINT NOT NULL,
  "aprobado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "retirado_por" BIGINT,
  "retirado_en" TIMESTAMPTZ,
  "motivo_retiro" TEXT,
  CONSTRAINT "conocimiento_bot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "conocimiento_bot_version_key" ON "conocimiento_bot" ("version");
CREATE INDEX IF NOT EXISTS "conocimiento_bot_estado_idx" ON "conocimiento_bot" ("estado", "aprobado_en");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprendizaje_noche_estado_check') THEN
    ALTER TABLE "aprendizaje_noche" ADD CONSTRAINT "aprendizaje_noche_estado_check"
      CHECK ("estado" IN ('OK','TOPE','SIN_IA','ERROR','EN_CURSO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprendizaje_propuesto_tipo_check') THEN
    ALTER TABLE "aprendizaje_propuesto" ADD CONSTRAINT "aprendizaje_propuesto_tipo_check"
      CHECK ("tipo" IN ('FAQ','FRASES','DERIVAR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprendizaje_propuesto_estado_check') THEN
    ALTER TABLE "aprendizaje_propuesto" ADD CONSTRAINT "aprendizaje_propuesto_estado_check"
      CHECK ("estado" IN ('PENDIENTE','APROBADO','DESCARTADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conocimiento_bot_tipo_check') THEN
    ALTER TABLE "conocimiento_bot" ADD CONSTRAINT "conocimiento_bot_tipo_check"
      CHECK ("tipo" IN ('FAQ','FRASES','DERIVAR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conocimiento_bot_estado_check') THEN
    ALTER TABLE "conocimiento_bot" ADD CONSTRAINT "conocimiento_bot_estado_check"
      CHECK ("estado" IN ('VIGENTE','RETIRADO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprendizaje_propuesto_noche_id_fkey') THEN
    ALTER TABLE "aprendizaje_propuesto" ADD CONSTRAINT "aprendizaje_propuesto_noche_id_fkey"
      FOREIGN KEY ("noche_id") REFERENCES "aprendizaje_noche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aprendizaje_propuesto_decidido_por_fkey') THEN
    ALTER TABLE "aprendizaje_propuesto" ADD CONSTRAINT "aprendizaje_propuesto_decidido_por_fkey"
      FOREIGN KEY ("decidido_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conocimiento_bot_aprendizaje_id_fkey') THEN
    ALTER TABLE "conocimiento_bot" ADD CONSTRAINT "conocimiento_bot_aprendizaje_id_fkey"
      FOREIGN KEY ("aprendizaje_id") REFERENCES "aprendizaje_propuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conocimiento_bot_aprobado_por_fkey') THEN
    ALTER TABLE "conocimiento_bot" ADD CONSTRAINT "conocimiento_bot_aprobado_por_fkey"
      FOREIGN KEY ("aprobado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conocimiento_bot_retirado_por_fkey') THEN
    ALTER TABLE "conocimiento_bot" ADD CONSTRAINT "conocimiento_bot_retirado_por_fkey"
      FOREIGN KEY ("retirado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Parámetros (Configuración › Parámetros del sistema). Los valores de dinero/tarifa se ajustan a la tarifa vigente de OpenAI.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('aprendizaje_activo', '"si"'::jsonb),
  ('aprendizaje_tope_usd_noche', '"3"'::jsonb),
  ('aprendizaje_hora', '"3"'::jsonb),
  ('aprendizaje_min_repeticiones', '"3"'::jsonb),
  ('aprendizaje_tope_usd_historico', '"10"'::jsonb), -- tope TOTAL (US$) de cada corrida del análisis del historial completo
  ('aprendizaje_usd_por_millon_entrada', '"0.15"'::jsonb), -- gpt-4o-mini; ajustar a la tarifa vigente
  ('aprendizaje_usd_por_millon_salida', '"0.60"'::jsonb)   -- gpt-4o-mini; ajustar a la tarifa vigente
ON CONFLICT ("clave") DO NOTHING;

-- Permiso aprendizajes/ver y aprendizajes/aprobar: viven en el código (permisos.ts) y solo los recibe el rol ADMIN; sin filas aquí.
