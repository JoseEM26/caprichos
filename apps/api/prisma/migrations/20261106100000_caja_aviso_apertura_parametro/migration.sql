-- Parametro del aviso de caja sin abrir (aditivo, idempotente).
-- caja_aviso_apertura_min: minutos después de la hora de apertura del local en que la campana avisa a Caja
-- si la caja de hoy sigue sin abrir. ON CONFLICT DO NOTHING: no pisa lo que el dueño ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('caja_aviso_apertura_min', '15'::jsonb) ON CONFLICT ("clave") DO NOTHING;
