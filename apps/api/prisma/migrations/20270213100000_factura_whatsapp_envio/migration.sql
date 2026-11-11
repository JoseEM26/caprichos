-- Envío automático de la factura aceptada por SUNAT al WhatsApp del cliente: estado por comprobante (clave = idempotencia).
-- Aditiva e idempotente. No guarda el PDF ni el celular.
CREATE TABLE IF NOT EXISTS "factura_whatsapp_envio" (
  "comprobante_id"     BIGINT       NOT NULL,
  "estado"             TEXT         NOT NULL DEFAULT 'PENDIENTE',
  "via"                TEXT,
  "intentos"           INTEGER      NOT NULL DEFAULT 0,
  "proximo_intento_en" TIMESTAMPTZ,
  "enviado_en"         TIMESTAMPTZ,
  "detalle"            TEXT,
  "creado_en"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "actualizado_en"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "factura_whatsapp_envio_pkey" PRIMARY KEY ("comprobante_id")
);

DO $$ BEGIN
  ALTER TABLE "factura_whatsapp_envio"
    ADD CONSTRAINT "factura_whatsapp_envio_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "factura_whatsapp_envio"
    ADD CONSTRAINT "factura_whatsapp_envio_estado_chk" CHECK ("estado" IN ('PENDIENTE','ENVIADO','SIN_CELULAR','SIN_VENTANA','ERROR','APAGADO','OMITIDO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "factura_whatsapp_envio_estado_proximo_intento_en_idx" ON "factura_whatsapp_envio" ("estado", "proximo_intento_en");
