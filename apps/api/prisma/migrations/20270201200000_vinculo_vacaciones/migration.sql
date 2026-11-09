-- VÍNCULO Y VACACIONES DEL PERSONAL (aditiva e idempotente)
--
-- 1. vinculo_personal: historial del vínculo de cada persona (PLANILLA o CONTRATO_TEMPORAL). Una sola fila vigente
--    por persona (vigente_hasta NULL); cambiar de tipo cierra la vigente y abre otra. El contrato PDF es una fila
--    privada de "archivo". Régimen de vacaciones solo para PLANILLA (30 o 15 días al año).
-- 2. vacacion_movimiento: TOMADAS (rango de fechas), PAGADAS (liquidadas en dinero) y AJUSTE (con signo).
--    Se anulan con motivo, no se borran. Nunca mueve caja. Sin datos que migrar.

CREATE TABLE IF NOT EXISTS "vinculo_personal" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" VARCHAR(18) NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "fecha_fin" DATE,
    "regimen_vacaciones" INTEGER,
    "contrato_archivo_id" BIGINT,
    "notas" TEXT,
    "vigente_desde" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigente_hasta" TIMESTAMPTZ,
    "creado_por" BIGINT,
    CONSTRAINT "vinculo_personal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vinculo_personal_tipo_check" CHECK ("tipo" IN ('PLANILLA', 'CONTRATO_TEMPORAL')),
    CONSTRAINT "vinculo_personal_regimen_check" CHECK ("regimen_vacaciones" IS NULL OR "regimen_vacaciones" IN (15, 30)),
    CONSTRAINT "vinculo_personal_fechas_check" CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_ingreso"),
    CONSTRAINT "vinculo_personal_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vinculo_personal_contrato_fkey" FOREIGN KEY ("contrato_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "vinculo_personal_party_id_vigente_desde_idx" ON "vinculo_personal" ("party_id", "vigente_desde");
CREATE UNIQUE INDEX IF NOT EXISTS "vinculo_personal_vigente_unico" ON "vinculo_personal" ("party_id") WHERE "vigente_hasta" IS NULL;

CREATE TABLE IF NOT EXISTS "vacacion_movimiento" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "vinculo_id" BIGINT NOT NULL,
    "tipo" VARCHAR(8) NOT NULL,
    "fecha_desde" DATE NOT NULL,
    "fecha_hasta" DATE NOT NULL,
    "dias" DECIMAL(6,2) NOT NULL,
    "monto" DECIMAL(10,2),
    "motivo" TEXT,
    "creado_por" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "anulado_motivo" TEXT,
    CONSTRAINT "vacacion_movimiento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vacacion_movimiento_tipo_check" CHECK ("tipo" IN ('TOMADAS', 'PAGADAS', 'AJUSTE')),
    CONSTRAINT "vacacion_movimiento_dias_check" CHECK ("dias" <> 0 AND ("tipo" = 'AJUSTE' OR "dias" > 0)),
    CONSTRAINT "vacacion_movimiento_monto_check" CHECK ("monto" IS NULL OR "monto" >= 0),
    CONSTRAINT "vacacion_movimiento_fechas_check" CHECK ("fecha_hasta" >= "fecha_desde"),
    CONSTRAINT "vacacion_movimiento_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vacacion_movimiento_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculo_personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "vacacion_movimiento_party_id_fecha_desde_idx" ON "vacacion_movimiento" ("party_id", "fecha_desde");
