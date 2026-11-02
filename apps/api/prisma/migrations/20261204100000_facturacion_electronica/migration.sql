-- Facturación electrónica directa a SUNAT (BOLETA y FACTURA, modo SIMULADO o SUNAT). Todo aditivo: nada se borra.

-- Comprobante: estado de envío, respuesta, baja y emisor
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_estado" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_intentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_enlace_pdf" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_cadena_qr" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_hash" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "facturacion_respuesta" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "simulado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "baja_estado" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "baja_motivo" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "baja_en" TIMESTAMP(3);
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "baja_respuesta" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "emisor" TEXT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "resumen_emision_id" BIGINT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "resumen_baja_id" BIGINT;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "sunat_total_cents" INTEGER;
ALTER TABLE "comprobante" ADD COLUMN IF NOT EXISTS "sunat_igv_cents" INTEGER;

ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comprobante_direccion" TEXT;

-- Series de la boleta y la factura electrónicas, con su propio correlativo (empiezan en 1 al usarse)
INSERT INTO "secuencia_comprobante" ("serie", "ultimo_numero") VALUES ('B002', 0), ('F002', 0)
  ON CONFLICT ("serie") DO NOTHING;

-- XML firmado, ZIP y CDR por comprobante (conservación: años)
CREATE TABLE IF NOT EXISTS "comprobante_archivo" (
  "id" BIGSERIAL NOT NULL,
  "comprobante_id" BIGINT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "contenido" BYTEA NOT NULL,
  "sha256" TEXT NOT NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "comprobante_archivo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "comprobante_archivo_comprobante_id_tipo_idx" ON "comprobante_archivo" ("comprobante_id", "tipo");
DO $$ BEGIN
  ALTER TABLE "comprobante_archivo" ADD CONSTRAINT "comprobante_archivo_comprobante_id_fkey"
    FOREIGN KEY ("comprobante_id") REFERENCES "comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Resúmenes diarios (RC) y comunicaciones de baja (RA) con su ticket
CREATE TABLE IF NOT EXISTS "sunat_resumen" (
  "id" BIGSERIAL NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "fecha_referencia" TIMESTAMPTZ NOT NULL,
  "ticket" TEXT,
  "estado" TEXT NOT NULL,
  "respuesta" TEXT,
  "xml" BYTEA NOT NULL,
  "zip" BYTEA NOT NULL,
  "cdr" BYTEA,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sunat_resumen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sunat_resumen_nombre_key" ON "sunat_resumen" ("nombre");

-- Estados (se reemplazan por completo para que la migración sea repetible)
ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_facturacion_estado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_facturacion_estado"
  CHECK ("facturacion_estado" IS NULL OR "facturacion_estado" IN ('EMITIDO_SUNAT', 'RECHAZADO', 'PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'ENVIADA_RESUMEN'));

ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_baja_estado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_baja_estado"
  CHECK ("baja_estado" IS NULL OR "baja_estado" IN ('SOLICITADA', 'ACEPTADA', 'RECHAZADA', 'PENDIENTE_RESUMEN'));

ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_emisor";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_emisor"
  CHECK ("emisor" IS NULL OR "emisor" IN ('SIMULADO', 'SUNAT'));

DO $$ BEGIN
  ALTER TABLE "sunat_resumen" ADD CONSTRAINT "ck_sunat_resumen_estado"
    CHECK ("estado" IN ('PENDIENTE_ENVIO', 'ENVIADO', 'ACEPTADO', 'RECHAZADO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
