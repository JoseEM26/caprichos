-- Nuevo tipo de promoción: ENVIO_GRATIS (delivery gratis en un horario, días, fechas, canales y límite de uso).
-- Solo cambia la restricción de tipo; no hay columnas nuevas ni tablas.
ALTER TABLE "oferta" DROP CONSTRAINT "ck_oferta_tipo";
ALTER TABLE "oferta"
  ADD CONSTRAINT "ck_oferta_tipo" CHECK ("tipo" IN ('COMBO', 'LLEVA_PAGA', 'DESCUENTO', 'ENVIO_GRATIS'));
