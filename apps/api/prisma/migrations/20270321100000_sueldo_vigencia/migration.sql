-- Sueldo con vigencia: cada cambio de sueldo es una fila nueva con su fecha de inicio; la planilla calcula
-- cada día con el sueldo vigente ese día. sueldo_personal sigue siendo el sueldo de hoy (lo leen otros módulos).
-- Aditiva: los sueldos actuales quedan vigentes «desde siempre» (1900-01-01), así lo ya calculado no cambia.
CREATE TABLE IF NOT EXISTS "sueldo_vigencia" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "modalidad" VARCHAR(8) NOT NULL,
    "monto_semanal" DECIMAL(10,2) NOT NULL,
    "monto_mensual" DECIMAL(10,2) NOT NULL,
    "metodo_valor_hora" VARCHAR(12) NOT NULL DEFAULT 'PROGRAMADAS',
    "dias_mes" INTEGER,
    "horas_dia" DECIMAL(4,1),
    "tarifa_hora" DECIMAL(10,4),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" BIGINT,
    CONSTRAINT "sueldo_vigencia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sueldo_vigencia_modalidad_check" CHECK ("modalidad" IN ('SEMANAL', 'MENSUAL')),
    CONSTRAINT "sueldo_vigencia_monto_check" CHECK ("monto_semanal" >= 0 AND "monto_mensual" >= 0),
    CONSTRAINT "sueldo_vigencia_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "sueldo_vigencia_party_id_vigente_desde_key" ON "sueldo_vigencia"("party_id", "vigente_desde");

INSERT INTO "sueldo_vigencia" ("party_id", "vigente_desde", "modalidad", "monto_semanal", "monto_mensual", "metodo_valor_hora", "dias_mes", "horas_dia", "tarifa_hora", "creado_por")
SELECT "party_id", DATE '1900-01-01', "modalidad", "monto_semanal", "monto_mensual", "metodo_valor_hora", "dias_mes", "horas_dia", "tarifa_hora", "actualizado_por"
FROM "sueldo_personal"
ON CONFLICT ("party_id", "vigente_desde") DO NOTHING;
