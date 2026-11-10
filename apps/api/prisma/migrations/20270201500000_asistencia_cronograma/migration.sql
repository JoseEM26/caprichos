-- Marcas múltiples: la persona puede marcar varias veces; el servidor las interpreta por orden y pares.
-- Ya no hay unicidad por tipo (sigue la unicidad por QR: party_id + qr_slot).
DROP INDEX IF EXISTS "asistencia_marca_celular_unica";

-- Solicitudes de corrección de asistencia (no cuentan hasta que el admin las aprueba).
CREATE TABLE IF NOT EXISTS "asistencia_solicitud" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "jornada" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
    "creada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelta_por" BIGINT,
    "resuelta_en" TIMESTAMPTZ,
    "motivo_resolucion" TEXT,
    "marcas_ids" JSONB,
    CONSTRAINT "asistencia_solicitud_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asistencia_solicitud_estado_check" CHECK ("estado" IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
    CONSTRAINT "asistencia_solicitud_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asistencia_solicitud_resuelta_por_fkey" FOREIGN KEY ("resuelta_por") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "asistencia_solicitud_party_id_jornada_idx" ON "asistencia_solicitud" ("party_id", "jornada");
CREATE INDEX IF NOT EXISTS "asistencia_solicitud_estado_idx" ON "asistencia_solicitud" ("estado");
