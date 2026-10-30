-- Parametros de avisos de impresion (aditivo, idempotente).
-- impresion_alerta_min: minutos en cola sin agente antes del aviso por WhatsApp.
-- impresion_vence_min: minutos en cola a partir de los cuales el trabajo pasa a VENCIDO al reconectar.
-- ON CONFLICT DO NOTHING: no pisa lo que el dueño ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_alerta_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_vence_min', '180'::jsonb) ON CONFLICT ("clave") DO NOTHING;
