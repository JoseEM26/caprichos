-- Cupón con beneficio «envío gratis» (descuento_tipo = ENVIO_GRATIS) y horario opcional del cupón.
-- Sin horario/días/fechas (NULL o {}) el cupón vale todo el tiempo, como hasta ahora.
ALTER TABLE "cupon" DROP CONSTRAINT "ck_cupon_descuento_tipo";
ALTER TABLE "cupon"
  ADD CONSTRAINT "ck_cupon_descuento_tipo" CHECK ("descuento_tipo" IN ('PORCENTAJE', 'MONTO', 'ENVIO_GRATIS'));

ALTER TABLE "cupon"
  ADD COLUMN "dias" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "hora_desde" TIME,
  ADD COLUMN "hora_hasta" TIME,
  ADD COLUMN "fecha_desde" DATE,
  ADD COLUMN "fecha_hasta" DATE;
