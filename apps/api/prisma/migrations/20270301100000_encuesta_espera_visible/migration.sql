-- La espera de la encuesta (30 min tras la entrega) solo vivia como valor por defecto en el codigo: sin fila
-- en parametro no aparecia en Configuracion > Parametros y no se podia cambiar. Se crea con el mismo valor (30).
-- Si ya existia (alguien la fijo), no se toca.
INSERT INTO "parametro" ("clave", "valor") VALUES ('encuesta_espera_min', '30'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
