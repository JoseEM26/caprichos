-- Propinas en la planilla: registro de los días de propina ya pagados a cada persona (no se paga dos veces).
CREATE TABLE "planilla_propina_dia" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto_pagado" DECIMAL(12,2) NOT NULL,
    "planilla_periodo_id" BIGINT NOT NULL,

    CONSTRAINT "planilla_propina_dia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planilla_propina_dia_party_id_fecha_planilla_periodo_id_key" ON "planilla_propina_dia"("party_id", "fecha", "planilla_periodo_id");
CREATE INDEX "planilla_propina_dia_party_id_fecha_idx" ON "planilla_propina_dia"("party_id", "fecha");

ALTER TABLE "planilla_propina_dia" ADD CONSTRAINT "planilla_propina_dia_planilla_periodo_id_fkey" FOREIGN KEY ("planilla_periodo_id") REFERENCES "planilla_periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
