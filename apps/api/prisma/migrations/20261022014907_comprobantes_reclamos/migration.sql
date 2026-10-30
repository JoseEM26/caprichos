-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- CreateTable
CREATE TABLE "comprobante" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "numero_texto" TEXT NOT NULL,
    "documento" TEXT,
    "razon_social" TEXT,
    "emision" TEXT NOT NULL DEFAULT 'POR_EMITIR',
    "emitido_en" TIMESTAMPTZ,
    "emitido_por" BIGINT,
    "referencia_externa" TEXT,
    "copias_impresas" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencia_comprobante" (
    "serie" TEXT NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secuencia_comprobante_pkey" PRIMARY KEY ("serie")
);

-- CreateTable
CREATE TABLE "reclamo" (
    "id" BIGSERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "domicilio" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT,
    "pedido_id" BIGINT,
    "detalle" TEXT NOT NULL,
    "monto_reclamado" DECIMAL(12,2),
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "respuesta" TEXT,
    "respondido_por" BIGINT,
    "respondido_en" TIMESTAMPTZ,
    "fecha_limite" DATE NOT NULL,
    "aceptacion_privacidad" BOOLEAN NOT NULL DEFAULT true,
    "aceptado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reclamo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_pedido_id_key" ON "comprobante"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_numero_texto_key" ON "comprobante"("numero_texto");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_serie_numero_key" ON "comprobante"("serie", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "reclamo_numero_key" ON "reclamo"("numero");

-- AddForeignKey
ALTER TABLE "comprobante" ADD CONSTRAINT "comprobante_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante" ADD CONSTRAINT "comprobante_emitido_por_fkey" FOREIGN KEY ("emitido_por") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo" ADD CONSTRAINT "reclamo_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo" ADD CONSTRAINT "reclamo_respondido_por_fkey" FOREIGN KEY ("respondido_por") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones CHECK para tabla "comprobante"
ALTER TABLE "comprobante"
  ADD CONSTRAINT "ck_comprobante_tipo" CHECK ("tipo" IN ('NOTA_VENTA', 'BOLETA', 'FACTURA')),
  ADD CONSTRAINT "ck_comprobante_emision" CHECK ("emision" IN ('INTERNA', 'POR_EMITIR', 'EMITIDO')),
  ADD CONSTRAINT "ck_comprobante_numero" CHECK ("numero" > 0),
  ADD CONSTRAINT "ck_comprobante_copias_impresas" CHECK ("copias_impresas" >= 0);

-- Restricciones CHECK para tabla "secuencia_comprobante"
ALTER TABLE "secuencia_comprobante"
  ADD CONSTRAINT "ck_secuencia_comprobante_ultimo_numero" CHECK ("ultimo_numero" >= 0);

-- Restricciones CHECK para tabla "reclamo"
ALTER TABLE "reclamo"
  ADD CONSTRAINT "ck_reclamo_tipo" CHECK ("tipo" IN ('RECLAMO', 'QUEJA')),
  ADD CONSTRAINT "ck_reclamo_estado" CHECK ("estado" IN ('RECIBIDO', 'EN_REVISION', 'RESPONDIDO')),
  ADD CONSTRAINT "ck_reclamo_monto_reclamado" CHECK ("monto_reclamado" IS NULL OR "monto_reclamado" >= 0),
  ADD CONSTRAINT "ck_reclamo_numero_formato" CHECK ("numero" ~ '^LR-[0-9]{4}-[0-9]{6}$');

-- Inmutabilidad de "reclamo": un reclamo nunca se borra
CREATE OR REPLACE FUNCTION reclamo_no_se_borra() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Un reclamo no se puede borrar';
END;
$$;

CREATE TRIGGER tg_reclamo_no_borrar
  BEFORE DELETE ON "reclamo"
  FOR EACH ROW EXECUTE FUNCTION reclamo_no_se_borra();

