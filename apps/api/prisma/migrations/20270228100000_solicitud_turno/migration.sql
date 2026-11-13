-- Pedidos de reemplazo y cambio de turno del personal (el elegido acepta, Supervisión/Admin aprueba;
-- solo al aprobar se crean las filas de cobertura_turno). Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS "solicitud_turno" (
    "id" BIGSERIAL NOT NULL,
    "tipo" VARCHAR(12) NOT NULL,
    "solicitante_party_id" BIGINT NOT NULL,
    "reemplazo_party_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "desde" TIME NOT NULL,
    "hasta" TIME NOT NULL,
    "fecha_devolucion" DATE,
    "desde_devolucion" TIME,
    "hasta_devolucion" TIME,
    "motivo" TEXT NOT NULL,
    "estado" VARCHAR(18) NOT NULL DEFAULT 'PENDIENTE_ACEPTA',
    "aceptada_en" TIMESTAMPTZ,
    "resuelta_por" BIGINT,
    "resuelta_en" TIMESTAMPTZ,
    "motivo_resolucion" TEXT,
    "cobertura_ids" JSONB,
    "sin_marca_en" TIMESTAMPTZ,
    "creada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "solicitud_turno_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_solicitud_turno_tipo" CHECK ("tipo" IN ('REEMPLAZO', 'CAMBIO_TURNO')),
    CONSTRAINT "ck_solicitud_turno_estado" CHECK ("estado" IN ('PENDIENTE_ACEPTA', 'PENDIENTE_APRUEBA', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'VENCIDA', 'SIN_MARCA')),
    CONSTRAINT "ck_solicitud_turno_distintos" CHECK ("solicitante_party_id" <> "reemplazo_party_id"),
    CONSTRAINT "ck_solicitud_turno_cambio" CHECK ("tipo" = 'REEMPLAZO' OR ("fecha_devolucion" IS NOT NULL AND "desde_devolucion" IS NOT NULL AND "hasta_devolucion" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "solicitud_turno_reemplazo_party_id_estado_idx" ON "solicitud_turno" ("reemplazo_party_id", "estado");
CREATE INDEX IF NOT EXISTS "solicitud_turno_solicitante_party_id_fecha_idx" ON "solicitud_turno" ("solicitante_party_id", "fecha");
CREATE INDEX IF NOT EXISTS "solicitud_turno_estado_fecha_idx" ON "solicitud_turno" ("estado", "fecha");
