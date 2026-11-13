-- Por revisar muestra todos los casos desde 1 repetición. Solo cambia el valor si sigue en el de fábrica (3); idempotente.
UPDATE "parametro" SET "valor" = '"1"'::jsonb
WHERE "clave" = 'aprendizaje_min_repeticiones' AND "valor" IN ('"3"'::jsonb, '3'::jsonb);
