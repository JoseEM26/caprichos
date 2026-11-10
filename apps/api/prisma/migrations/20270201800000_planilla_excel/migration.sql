-- PLANILLA ESTILO EXCEL (aditiva e idempotente)
-- Valor hora por persona, datos de pago, etiqueta de los descuentos, préstamos con cuotas y descuentos recurrentes (Netflix).

ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "metodo_valor_hora" VARCHAR(12) NOT NULL DEFAULT 'PROGRAMADAS'; -- DIAS_HORAS | TARIFA_HORA | PROGRAMADAS (las filas existentes conservan el método anterior)
ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "dias_mes" INTEGER;
ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "horas_dia" DECIMAL(4,1);
ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "tarifa_hora" DECIMAL(10,4);
ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "pago_celular" VARCHAR(20);
ALTER TABLE "sueldo_personal" ADD COLUMN IF NOT EXISTS "pago_medio" VARCHAR(14); -- YAPE | PLIN | TRANSFERENCIA | EFECTIVO

ALTER TABLE "planilla_ajuste" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(10) NOT NULL DEFAULT 'OTRO'; -- CONSUMO | MERMA | DANO | PRESTAMO | NETFLIX | OTRO

CREATE TABLE IF NOT EXISTS "prestamo_personal" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "num_cuotas" INTEGER NOT NULL,
    "periodicidad" VARCHAR(8) NOT NULL,
    "monto_cuota" DECIMAL(10,2) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "estado" VARCHAR(8) NOT NULL DEFAULT 'ACTIVO',
    "motivo" TEXT,
    "anulado_motivo" TEXT,
    "creado_por" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prestamo_personal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prestamo_personal_periodicidad_check" CHECK ("periodicidad" IN ('SEMANAL', 'MENSUAL')),
    CONSTRAINT "prestamo_personal_estado_check" CHECK ("estado" IN ('ACTIVO', 'SALDADO', 'ANULADO')),
    CONSTRAINT "prestamo_personal_monto_check" CHECK ("monto" > 0 AND "num_cuotas" >= 1)
);
CREATE INDEX IF NOT EXISTS "prestamo_personal_party_id_estado_idx" ON "prestamo_personal" ("party_id", "estado");

CREATE TABLE IF NOT EXISTS "prestamo_cuota" (
    "id" BIGSERIAL NOT NULL,
    "prestamo_id" BIGINT NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
    "periodo_desde" DATE,
    "periodo_hasta" DATE,
    "planilla_periodo_id" BIGINT,
    "reprogramada_de" BIGINT, -- cuota omitida de la que nace esta, añadida al final del plan
    CONSTRAINT "prestamo_cuota_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prestamo_cuota_estado_check" CHECK ("estado" IN ('PENDIENTE', 'DESCONTADA', 'OMITIDA')),
    CONSTRAINT "prestamo_cuota_prestamo_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamo_personal" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "prestamo_cuota_prestamo_id_estado_idx" ON "prestamo_cuota" ("prestamo_id", "estado");
CREATE INDEX IF NOT EXISTS "prestamo_cuota_planilla_periodo_id_idx" ON "prestamo_cuota" ("planilla_periodo_id");

CREATE TABLE IF NOT EXISTS "descuento_recurrente_personal" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" VARCHAR(8) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "periodicidad" VARCHAR(8) NOT NULL DEFAULT 'SEMANAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "desde" DATE NOT NULL,
    "creado_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "descuento_recurrente_personal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "descuento_recurrente_personal_tipo_check" CHECK ("tipo" IN ('NETFLIX', 'OTRO')),
    CONSTRAINT "descuento_recurrente_personal_periodicidad_check" CHECK ("periodicidad" = 'SEMANAL'),
    CONSTRAINT "descuento_recurrente_personal_monto_check" CHECK ("monto" >= 0)
);
CREATE INDEX IF NOT EXISTS "descuento_recurrente_personal_party_id_idx" ON "descuento_recurrente_personal" ("party_id");
