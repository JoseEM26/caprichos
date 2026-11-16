-- Medios de pago por defecto de salida a producción (CARTA y BOT). CAJA y MOZO no se tocan (el local cobra con POS y Plin en persona).
-- Idempotente; funciona con o sin el parámetro. El pago dividido (2 o 3 medios) no tiene interruptor: usa los medios encendidos.

-- Si el parámetro no existe: JSON completo (CAJA y MOZO todo encendido salvo PAGO_EN_LINEA)
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('medios_pago_canal', '{"CARTA": {"EFECTIVO": true, "YAPE": true, "PLIN": false, "TARJETA": false, "TRANSFERENCIA": true, "PAGO_EN_LINEA": true}, "CAJA": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "MOZO": {"EFECTIVO": true, "YAPE": true, "PLIN": true, "TARJETA": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}, "BOT": {"EFECTIVO": true, "YAPE": true, "PLIN": false, "TARJETA": false, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false}}'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- Si ya existe: se fusionan solo las claves de CARTA y BOT (lo demás queda como esté)
UPDATE "parametro"
SET "valor" = "valor" || jsonb_build_object(
  'CARTA', COALESCE("valor"->'CARTA', '{}'::jsonb) || '{"EFECTIVO": true, "YAPE": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": true, "PLIN": false, "TARJETA": false}'::jsonb,
  'BOT',   COALESCE("valor"->'BOT',   '{}'::jsonb) || '{"EFECTIVO": true, "YAPE": true, "TRANSFERENCIA": true, "PAGO_EN_LINEA": false, "PLIN": false, "TARJETA": false}'::jsonb
)
WHERE "clave" = 'medios_pago_canal' AND jsonb_typeof("valor") = 'object';
