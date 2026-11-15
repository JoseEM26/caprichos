-- «Servicio o producto» (cargo libre): una línea de pedido más, sin producto, con descripción y monto que escribe
-- Caja o el mozo. Se cobra con el pedido; no descuenta stock. Queda quién la agregó y cuándo.
ALTER TABLE "pedido_linea"
  ADD COLUMN "cargo_libre" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cargo_libre_por" BIGINT,
  ADD COLUMN "cargo_libre_en" TIMESTAMPTZ;

ALTER TABLE "pedido_linea"
  ADD CONSTRAINT "pedido_linea_cargo_libre_chk" CHECK (
    NOT "cargo_libre" OR (
      "producto_id" IS NULL
      AND "oferta_id" IS NULL
      AND "precio_unit" > 0 AND "precio_unit" <= 500
      AND char_length(btrim("nombre")) BETWEEN 1 AND 120
    )
  );

CREATE INDEX "pedido_linea_cargo_libre_idx" ON "pedido_linea"("pedido_id") WHERE "cargo_libre";
