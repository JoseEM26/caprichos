-- PLANILLA DEL PERSONAL + MARCA POR USUARIO Y CONTRASEÑA (aditiva e idempotente)
--
-- 1. asistencia_marca: origen WEB (usuario y contraseña, sin GPS ni selfie), estados APROBADA y ANULADA,
--    y quién/cuándo/por qué se revisó. La fila nunca se borra. El índice único de marcas por celular
--    ignora las anuladas (se puede volver a marcar). Las marcas WEB no tienen índice único: el orden
--    de la jornada lo valida el servicio.
-- 2. sueldo_personal: modalidad SEMANAL/MENSUAL y ambos montos (uno se calcula del otro).
-- 3. planilla_ajuste: adelantos y descuentos manuales; se anulan con motivo, no se borran.
-- 4. planilla_extra_aprobada: horas extra aprobadas por jornada (quién y cuándo).
-- 5. planilla_periodo: período pagado con sus cifras congeladas; se reabre con motivo (queda REABIERTO).
-- Nunca mueve caja. Sin datos que migrar.

ALTER TABLE "asistencia_marca" ADD COLUMN IF NOT EXISTS "revisado_por" BIGINT;
ALTER TABLE "asistencia_marca" ADD COLUMN IF NOT EXISTS "revisado_en" TIMESTAMPTZ;
ALTER TABLE "asistencia_marca" ADD COLUMN IF NOT EXISTS "revisado_motivo" TEXT;

ALTER TABLE "asistencia_marca" DROP CONSTRAINT IF EXISTS "asistencia_marca_origen_check";
ALTER TABLE "asistencia_marca" ADD CONSTRAINT "asistencia_marca_origen_check" CHECK ("origen" IN ('CELULAR', 'CORRECCION', 'WEB'));
ALTER TABLE "asistencia_marca" DROP CONSTRAINT IF EXISTS "asistencia_marca_estado_check";
ALTER TABLE "asistencia_marca" ADD CONSTRAINT "asistencia_marca_estado_check" CHECK ("estado" IN ('VALIDA', 'A_REVISAR', 'APROBADA', 'ANULADA'));

DROP INDEX IF EXISTS "asistencia_marca_celular_unica";
CREATE UNIQUE INDEX IF NOT EXISTS "asistencia_marca_celular_unica"
  ON "asistencia_marca" ("party_id", "jornada", "tipo") WHERE "origen" = 'CELULAR' AND "estado" <> 'ANULADA';

CREATE TABLE IF NOT EXISTS "sueldo_personal" (
    "party_id" BIGINT NOT NULL,
    "modalidad" VARCHAR(8) NOT NULL,
    "monto_semanal" DECIMAL(10,2) NOT NULL,
    "monto_mensual" DECIMAL(10,2) NOT NULL,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_por" BIGINT,
    CONSTRAINT "sueldo_personal_pkey" PRIMARY KEY ("party_id"),
    CONSTRAINT "sueldo_personal_modalidad_check" CHECK ("modalidad" IN ('SEMANAL', 'MENSUAL')),
    CONSTRAINT "sueldo_personal_monto_check" CHECK ("monto_semanal" >= 0 AND "monto_mensual" >= 0),
    CONSTRAINT "sueldo_personal_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "planilla_ajuste" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "creado_por" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "anulado_motivo" TEXT,
    CONSTRAINT "planilla_ajuste_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planilla_ajuste_tipo_check" CHECK ("tipo" IN ('ADELANTO', 'DESCUENTO')),
    CONSTRAINT "planilla_ajuste_monto_check" CHECK ("monto" > 0),
    CONSTRAINT "planilla_ajuste_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "planilla_ajuste_party_id_fecha_idx" ON "planilla_ajuste" ("party_id", "fecha");

CREATE TABLE IF NOT EXISTS "planilla_extra_aprobada" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "jornada" DATE NOT NULL,
    "aprobado_por" BIGINT NOT NULL,
    "aprobado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planilla_extra_aprobada_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planilla_extra_aprobada_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "planilla_extra_aprobada_party_id_jornada_key" ON "planilla_extra_aprobada" ("party_id", "jornada");

CREATE TABLE IF NOT EXISTS "planilla_periodo" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "modalidad" VARCHAR(8) NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'PAGADO',
    "neto" DECIMAL(10,2) NOT NULL,
    "detalle" JSONB NOT NULL,
    "pagado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagado_por" BIGINT NOT NULL,
    "reabierto_en" TIMESTAMPTZ,
    "reabierto_por" BIGINT,
    "reabierto_motivo" TEXT,
    CONSTRAINT "planilla_periodo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planilla_periodo_estado_check" CHECK ("estado" IN ('PAGADO', 'REABIERTO')),
    CONSTRAINT "planilla_periodo_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "planilla_periodo_party_id_desde_idx" ON "planilla_periodo" ("party_id", "desde");
-- Un solo pago vigente por persona y período
CREATE UNIQUE INDEX IF NOT EXISTS "planilla_periodo_pagado_unico" ON "planilla_periodo" ("party_id", "desde") WHERE "estado" = 'PAGADO';
