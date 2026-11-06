-- REPARTO MENSUAL DE PROPINAS POR HORAS TRABAJADAS (aditiva e idempotente).
--
-- 1. person.participa_propinas: excepción por persona fijada por el ADMIN. NULL = según rol
--    (ADMIN no participa; el resto del personal con horario o marcas sí). true/false = forzado.
-- 2. propina_reparto: un reparto por mes. Un solo VIGENTE (no ANULADO) por mes: índice único parcial.
--    BORRADOR se recalcula; APROBADO congela; PAGADO cuando todas las filas tienen pagado_en; ANULADO con motivo.
-- 3. propina_reparto_detalle: parte de cada persona (horas, %, monto). Sin ajuste de uso en esta fase
--    (ajuste_centimos queda reservado).
-- 4. permiso propinas/repartir: solo ADMIN.
--
-- Clasificación: tablas con dinero y referencias a party (personal). Reset: se CONSERVAN (historial de
-- pagos) y las FK a party son de personal. Migración de datos: NO se migran (dinero real del día).
-- Sin datos que migrar.

ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "participa_propinas" BOOLEAN;

CREATE TABLE IF NOT EXISTS "propina_reparto" (
    "id" BIGSERIAL NOT NULL,
    "anio" SMALLINT NOT NULL,
    "mes" SMALLINT NOT NULL,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'BORRADOR',
    "total_propinas" DECIMAL(12,2) NOT NULL,
    "total_horas" DECIMAL(10,2) NOT NULL,
    "calculado_en" TIMESTAMPTZ NOT NULL,
    "calculado_por" BIGINT NOT NULL,
    "aprobado_en" TIMESTAMPTZ,
    "aprobado_por" BIGINT,
    "pagado_en" TIMESTAMPTZ,
    "pagado_por" BIGINT,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "motivo_anulacion" TEXT,
    "nota" TEXT,
    CONSTRAINT "propina_reparto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "propina_reparto_estado_check" CHECK ("estado" IN ('BORRADOR', 'APROBADO', 'PAGADO', 'ANULADO')),
    CONSTRAINT "propina_reparto_mes_check" CHECK ("mes" BETWEEN 1 AND 12),
    CONSTRAINT "propina_reparto_total_check" CHECK ("total_propinas" >= 0 AND "total_horas" >= 0),
    CONSTRAINT "propina_reparto_calculado_por_fkey" FOREIGN KEY ("calculado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "propina_reparto_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "propina_reparto_pagado_por_fkey" FOREIGN KEY ("pagado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "propina_reparto_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "propina_reparto_anio_mes_idx" ON "propina_reparto" ("anio", "mes");
CREATE UNIQUE INDEX IF NOT EXISTS "propina_reparto_vigente_unico" ON "propina_reparto" ("anio", "mes") WHERE "estado" <> 'ANULADO';

CREATE TABLE IF NOT EXISTS "propina_reparto_detalle" (
    "reparto_id" BIGINT NOT NULL,
    "party_id" BIGINT NOT NULL,
    "horas" DECIMAL(10,2) NOT NULL,
    "porcentaje" DECIMAL(9,4) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "ajuste_centimos" INTEGER,
    "pagado_en" TIMESTAMPTZ,
    "pagado_medio" VARCHAR(20),
    "nota" TEXT,
    CONSTRAINT "propina_reparto_detalle_pkey" PRIMARY KEY ("reparto_id", "party_id"),
    CONSTRAINT "propina_reparto_detalle_horas_check" CHECK ("horas" > 0),
    CONSTRAINT "propina_reparto_detalle_monto_check" CHECK ("monto" >= 0),
    CONSTRAINT "propina_reparto_detalle_reparto_id_fkey" FOREIGN KEY ("reparto_id") REFERENCES "propina_reparto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "propina_reparto_detalle_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "permiso" ("modulo", "accion") VALUES ('propinas', 'repartir') ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "permiso" p
JOIN "rol" r ON r."codigo" IN ('ADMIN')
WHERE p."modulo" = 'propinas' AND p."accion" = 'repartir'
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
