-- Medios de pago activables por canal. Todo lo que ya existía queda encendido; PAGO_EN_LINEA (pasarela) apagado.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('medios_pago_canal', '{"CARTA": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "CAJA": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "MOZO": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "BOT": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}}'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
