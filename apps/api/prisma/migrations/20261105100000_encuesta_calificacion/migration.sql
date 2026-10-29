-- Calificación de la encuesta posventa (solo parámetros, aditivo, idempotente).
-- encuesta_ventana_dias: días hacia atrás en que una encuesta ENVIADA sigue aceptando calificación por WhatsApp.
-- encuesta_puntaje_queja: calificación igual o menor a este valor genera queja, campana y aviso a administradores.
INSERT INTO "parametro" ("clave", "valor") VALUES ('encuesta_ventana_dias', '7'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('encuesta_puntaje_queja', '2'::jsonb) ON CONFLICT ("clave") DO NOTHING;
