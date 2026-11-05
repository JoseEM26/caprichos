-- Las promociones y descuentos ya desactivados dejan de llenar la carta virtual.
-- Solo cambia visible_carta de las inactivas; las activas no cambian. Idempotente.
UPDATE "oferta" SET "visible_carta" = false WHERE "activo" = false AND "visible_carta" = true;
