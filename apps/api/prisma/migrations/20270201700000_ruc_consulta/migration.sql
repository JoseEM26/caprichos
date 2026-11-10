-- Caché de consultas de RUC (API gratuita). razon_social vacía = negativo cacheado.
CREATE TABLE IF NOT EXISTS "ruc_consulta" (
  "ruc" VARCHAR(11) NOT NULL,
  "razon_social" TEXT NOT NULL,
  "estado" TEXT,
  "condicion" TEXT,
  "direccion" TEXT,
  "ubigeo" TEXT,
  "fuente" TEXT,
  "as_of" TEXT,
  "respuesta" JSONB NOT NULL,
  "consultado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ruc_consulta_pkey" PRIMARY KEY ("ruc")
);
CREATE INDEX IF NOT EXISTS "ruc_consulta_actualizado_en_idx" ON "ruc_consulta"("actualizado_en");

-- Marca de verificación de la razón social de la factura (true SUNAT, false manual, null no aplica)
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comprobante_razon_verificada" BOOLEAN;
