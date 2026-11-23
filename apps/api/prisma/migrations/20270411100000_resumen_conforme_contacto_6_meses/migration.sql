-- Decisión del dueño (23/11/2026): el resumen del pedido («recibido») sale solo también a quien escribió en los últimos 6 meses
-- (evolution_resumen_contacto_dias = 180; 0 = solo 24 h) y el cliente puede confirmarlo respondiendo OK / CONFORME.
ALTER TABLE "pedido" ADD COLUMN "cliente_conforme_en" TIMESTAMP(3);
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('evolution_resumen_contacto_dias', '180'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
