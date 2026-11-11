-- Datos para facturar de la cuenta del cliente (identificada por celular): un RUC opcional por cuenta, con su razón
-- social y dirección fiscal. Aditiva e idempotente. El DNI NO se guarda aquí.
CREATE TABLE IF NOT EXISTS "cliente_facturacion" (
  "party_id"     BIGINT       NOT NULL,
  "ruc"          VARCHAR(11)  NOT NULL,
  "razon_social" TEXT,
  "direccion"    TEXT,
  "origen"       TEXT         NOT NULL,
  "creado_en"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "cliente_facturacion_pkey" PRIMARY KEY ("party_id")
);

DO $$ BEGIN
  ALTER TABLE "cliente_facturacion"
    ADD CONSTRAINT "cliente_facturacion_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cliente_facturacion"
    ADD CONSTRAINT "cliente_facturacion_ruc_chk" CHECK ("ruc" ~ '^(10|15|17|20)[0-9]{9}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
