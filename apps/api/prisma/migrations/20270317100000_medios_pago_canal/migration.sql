-- Medios de pago activables por canal. Todo lo que ya existía queda encendido; PAGO_EN_LINEA (pasarela) apagado.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('medios_pago_canal', '{"CARTA": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "CAJA": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "MOZO": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "BOT": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}}'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- «Pago en línea» (Culqi) pasa a ser un medio más: su interruptor de la carta reemplaza a pago_online_activo (una sola fuente de verdad).
-- Se conserva lo que estaba encendido y se quita el parámetro viejo.
UPDATE "parametro"
SET "valor" = jsonb_set("valor", '{CARTA,PAGO_EN_LINEA}', 'true'::jsonb)
WHERE "clave" = 'medios_pago_canal'
  AND EXISTS (SELECT 1 FROM "parametro" WHERE "clave" = 'pago_online_activo' AND lower(trim(both '"' from "valor"::text)) IN ('si', 'sí', 'true'));
DELETE FROM "parametro" WHERE "clave" = 'pago_online_activo';
