-- Parametro de pegado automatico de zonas de reparto (aditivo, idempotente).
-- zonas_snap_m: metros dentro de los cuales los vertices y lados de una zona se pegan a los de sus vecinas.
INSERT INTO "parametro" ("clave", "valor") VALUES ('zonas_snap_m', '15'::jsonb) ON CONFLICT ("clave") DO NOTHING;
