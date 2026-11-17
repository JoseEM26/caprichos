-- Tarifa especial por persona (p. ej. domingos desde las 19:00 a una tarifa por hora fija).
-- Aditiva: tabla nueva, sin tocar datos. Reversión: DROP TABLE "tarifa_especial_persona";
CREATE TABLE "tarifa_especial_persona" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "desde_minutos" SMALLINT NOT NULL,
    "tarifa_hora" DECIMAL(10,2) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "nota" VARCHAR(200),
    "creado_por" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarifa_especial_persona_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tarifa_especial_persona_dia_check" CHECK ("dia_semana" BETWEEN 0 AND 6),
    CONSTRAINT "tarifa_especial_persona_desde_check" CHECK ("desde_minutos" BETWEEN 0 AND 1439),
    CONSTRAINT "tarifa_especial_persona_tarifa_check" CHECK ("tarifa_hora" > 0),
    CONSTRAINT "tarifa_especial_persona_vigencia_check" CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde")
);

CREATE INDEX "tarifa_especial_persona_party_id_idx" ON "tarifa_especial_persona"("party_id");
