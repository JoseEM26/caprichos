-- Selecciones del pago por persona y período (antes solo vivían en el navegador).
-- Aditiva: tabla nueva, sin tocar datos. Reversión: DROP TABLE "planilla_seleccion";
CREATE TABLE "planilla_seleccion" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "periodo_desde" DATE NOT NULL,
    "tipo" VARCHAR(24) NOT NULL,
    "ref_id" VARCHAR(64) NOT NULL,
    "creado_por" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planilla_seleccion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planilla_seleccion_tipo_check" CHECK ("tipo" IN ('CONSUMO_EXCLUIDO', 'CONSUMO_ANTERIOR_INCLUIDO', 'CUOTA_OMITIDA', 'RECURRENTE_OMITIDO'))
);

CREATE UNIQUE INDEX "planilla_seleccion_party_id_periodo_desde_tipo_ref_id_key" ON "planilla_seleccion"("party_id", "periodo_desde", "tipo", "ref_id");
