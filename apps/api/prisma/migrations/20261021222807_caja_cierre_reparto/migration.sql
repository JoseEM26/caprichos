-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "llego_en" TIMESTAMPTZ,
ADD COLUMN     "motivo_falla" TEXT,
ADD COLUMN     "repartidor_party_id" BIGINT,
ADD COLUMN     "salio_en" TIMESTAMPTZ,
ADD COLUMN     "tomado_en" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "caja" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "apertura" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "abierta_por" BIGINT NOT NULL,
    "cerrada_por" BIGINT,
    "cerrada_en" TIMESTAMPTZ,

    CONSTRAINT "caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobro" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "caja_id" BIGINT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "credito_personal" BOOLEAN NOT NULL DEFAULT false,
    "cobrado_por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "motivo_anulacion" TEXT,

    CONSTRAINT "cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobro_pago" (
    "id" BIGSERIAL NOT NULL,
    "cobro_id" BIGINT NOT NULL,
    "medio" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "recibido" DECIMAL(12,2),
    "vuelto" DECIMAL(12,2),

    CONSTRAINT "cobro_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_caja" (
    "id" BIGSERIAL NOT NULL,
    "caja_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "anulado_en" TIMESTAMPTZ,
    "motivo_anulacion" TEXT,

    CONSTRAINT "movimiento_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" BIGSERIAL NOT NULL,
    "caja_id" BIGINT NOT NULL,
    "repartidor_party_id" BIGINT NOT NULL,
    "esperado" DECIMAL(12,2) NOT NULL,
    "entregado" DECIMAL(12,2) NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_caja" (
    "caja_id" BIGINT NOT NULL,
    "conteo" JSONB NOT NULL,
    "resultado" TEXT NOT NULL,
    "aprobado_por" BIGINT,
    "nota" TEXT,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("caja_id")
);

-- CreateTable
CREATE TABLE "conteo_cierre" (
    "caja_id" BIGINT NOT NULL,
    "intento" SMALLINT NOT NULL,
    "conteo" JSONB NOT NULL,
    "medios" JSONB NOT NULL,
    "resultado" TEXT NOT NULL,
    "por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteo_cierre_pkey" PRIMARY KEY ("caja_id","intento")
);

-- CreateTable
CREATE TABLE "cierre_medio" (
    "caja_id" BIGINT NOT NULL,
    "medio" TEXT NOT NULL,
    "sistema" DECIMAL(12,2) NOT NULL,
    "visto" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) GENERATED ALWAYS AS ("visto" - "sistema") STORED,

    CONSTRAINT "cierre_medio_pkey" PRIMARY KEY ("caja_id","medio")
);

-- CreateTable
CREATE TABLE "incidente_entrega" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "motivo" TEXT NOT NULL,
    "intento" INTEGER NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cierre" TEXT,
    "recargo" DECIMAL(12,2),
    "cerrado_por" BIGINT,
    "contactos" JSONB NOT NULL DEFAULT '[]',
    "foto_archivo_id" BIGINT,

    CONSTRAINT "incidente_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensaje_reparto" (
    "pedido_id" BIGINT NOT NULL,
    "numero" SMALLINT NOT NULL,
    "enviado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido_en" TIMESTAMPTZ,
    "estado" TEXT NOT NULL DEFAULT 'ENVIADO',

    CONSTRAINT "mensaje_reparto_pkey" PRIMARY KEY ("pedido_id","numero")
);

-- CreateIndex
CREATE UNIQUE INDEX "caja_fecha_key" ON "caja"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cobro_pedido_id_key" ON "cobro"("pedido_id");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_repartidor_party_id_fkey" FOREIGN KEY ("repartidor_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobro_pago" ADD CONSTRAINT "cobro_pago_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "cobro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_repartidor_party_id_fkey" FOREIGN KEY ("repartidor_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteo_cierre" ADD CONSTRAINT "conteo_cierre_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_medio" ADD CONSTRAINT "cierre_medio_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cierre_caja"("caja_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente_entrega" ADD CONSTRAINT "incidente_entrega_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidente_entrega" ADD CONSTRAINT "incidente_entrega_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "mensaje_reparto_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================
-- Restricciones CHECK, índices condicionales y disparadores
-- =========================================================

-- Índice único condicional: solo una caja abierta a la vez
CREATE UNIQUE INDEX "ux_una_caja_abierta" ON "caja" ("estado") WHERE "estado" = 'ABIERTA';

-- Restricciones CHECK para tabla "caja"
ALTER TABLE "caja"
  ADD CONSTRAINT "ck_caja_estado" CHECK ("estado" IN ('ABIERTA', 'CERRADA')),
  ADD CONSTRAINT "ck_caja_apertura" CHECK ("apertura" >= 0);

-- Restricciones CHECK para tabla "cobro"
ALTER TABLE "cobro"
  ADD CONSTRAINT "ck_cobro_total" CHECK ("total" >= 0);

-- Restricciones CHECK para tabla "cobro_pago"
ALTER TABLE "cobro_pago"
  ADD CONSTRAINT "ck_cobro_pago_medio" CHECK ("medio" IN ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO')),
  ADD CONSTRAINT "ck_cobro_pago_monto" CHECK ("monto" > 0),
  ADD CONSTRAINT "ck_cobro_pago_recibido" CHECK ("recibido" IS NULL OR "recibido" >= 0),
  ADD CONSTRAINT "ck_cobro_pago_vuelto" CHECK ("vuelto" IS NULL OR "vuelto" >= 0);

-- Restricciones CHECK para tabla "movimiento_caja"
ALTER TABLE "movimiento_caja"
  ADD CONSTRAINT "ck_movimiento_caja_tipo" CHECK ("tipo" IN ('INGRESO', 'EGRESO')),
  ADD CONSTRAINT "ck_movimiento_caja_monto" CHECK ("monto" > 0);

-- Restricciones CHECK para tabla "liquidacion"
ALTER TABLE "liquidacion"
  ADD CONSTRAINT "ck_liquidacion_esperado" CHECK ("esperado" >= 0),
  ADD CONSTRAINT "ck_liquidacion_entregado" CHECK ("entregado" >= 0);

-- Restricciones CHECK para tabla "cierre_caja"
ALTER TABLE "cierre_caja"
  ADD CONSTRAINT "ck_cierre_caja_resultado" CHECK ("resultado" IN ('CUADRA', 'NO_CUADRA')),
  ADD CONSTRAINT "ck_cierre_caja_aprobacion" CHECK ("resultado" = 'CUADRA' OR "aprobado_por" IS NOT NULL);

-- Inmutabilidad de "cierre_caja": no se edita ni se borra (RN-CAP-080)
CREATE OR REPLACE FUNCTION cierre_caja_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El cierre de caja no se edita ni se borra';
END;
$$;

CREATE TRIGGER tg_cierre_caja_inmutable
  BEFORE UPDATE OR DELETE ON "cierre_caja"
  FOR EACH ROW EXECUTE FUNCTION cierre_caja_inmutable();

-- Restricciones CHECK para tabla "conteo_cierre"
ALTER TABLE "conteo_cierre"
  ADD CONSTRAINT "ck_conteo_cierre_resultado" CHECK ("resultado" IN ('CUADRA', 'NO_CUADRA')),
  ADD CONSTRAINT "ck_conteo_cierre_intento" CHECK ("intento" > 0);

-- Restricciones CHECK para tabla "incidente_entrega"
ALTER TABLE "incidente_entrega"
  ADD CONSTRAINT "ck_incidente_entrega_motivo" CHECK ("motivo" IN ('NO_CONTESTA', 'DIRECCION_NO_ENCONTRADA')),
  ADD CONSTRAINT "ck_incidente_entrega_intento" CHECK ("intento" > 0),
  ADD CONSTRAINT "ck_incidente_entrega_cierre" CHECK ("cierre" IS NULL OR "cierre" IN ('REPROGRAMADO', 'DEVUELTO', 'COBRADO_IGUAL')),
  ADD CONSTRAINT "ck_incidente_entrega_recargo" CHECK ("recargo" IS NULL OR "recargo" >= 0);

-- Restricciones CHECK para tabla "mensaje_reparto"
ALTER TABLE "mensaje_reparto"
  ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 3),
  ADD CONSTRAINT "ck_mensaje_reparto_estado" CHECK ("estado" IN ('PENDIENTE', 'ENVIADO', 'RESPONDIDO', 'FALLIDO'));

