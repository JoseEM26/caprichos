-- Por defecto ninguna promoción ni cupón existente vale por WhatsApp (bot): se quita BOT de sus canales.
-- A partir de ahora el dueño marca la casilla «Vale también por WhatsApp (bot)» en cada promoción.
-- Los cupones no se aceptan por chat, así que su BOT nunca aplicó: se quita igual.
UPDATE "oferta" SET "canales" = array_remove("canales", 'BOT') WHERE 'BOT' = ANY("canales");
UPDATE "cupon" SET "canales" = array_remove("canales", 'BOT') WHERE 'BOT' = ANY("canales");
