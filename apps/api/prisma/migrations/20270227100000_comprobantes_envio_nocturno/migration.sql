-- Envío nocturno de boletas y facturas: al cobrar el comprobante queda POR_EMITIR_NOCHE sin serie ni número
-- (se asignan al emitirlo, así un cambio del día no deja huecos). Y el cambio de comprobante de un pedido ya
-- cobrado queda pendiente hasta la noche (una fila por pedido: cambiar de nuevo reemplaza a la anterior).
-- Aditiva e idempotente.
ALTER TABLE "comprobante" ALTER COLUMN "serie" DROP NOT NULL;
ALTER TABLE "comprobante" ALTER COLUMN "numero" DROP NOT NULL;
ALTER TABLE "comprobante" ALTER COLUMN "numero_texto" DROP NOT NULL;

ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_facturacion_estado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_facturacion_estado"
  CHECK ("facturacion_estado" IS NULL OR "facturacion_estado" IN ('EMITIDO_SUNAT', 'RECHAZADO', 'PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'ENVIADA_RESUMEN', 'REVISION_MANUAL', 'POR_EMITIR_NOCHE'));

-- Solo el que espera la noche puede no tener número
ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_numero_asignado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_numero_asignado"
  CHECK ("facturacion_estado" = 'POR_EMITIR_NOCHE' OR ("serie" IS NOT NULL AND "numero" IS NOT NULL AND "numero_texto" IS NOT NULL));

CREATE TABLE IF NOT EXISTS "comprobante_cambio_pendiente" (
  "pedido_id"     BIGINT PRIMARY KEY REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipo"          TEXT NOT NULL,
  "documento"     TEXT,
  "razon_social"  TEXT,
  "direccion"     TEXT,
  "motivo"        TEXT NOT NULL,
  "solicitado_por" BIGINT,
  "solicitado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ck_comprobante_cambio_tipo" CHECK ("tipo" IN ('SIMPLE', 'BOLETA', 'FACTURA')),
  CONSTRAINT "ck_comprobante_cambio_motivo" CHECK (char_length("motivo") >= 5)
);
