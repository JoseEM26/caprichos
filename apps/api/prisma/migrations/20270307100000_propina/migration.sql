-- La migración original de propinas dejó la carta y el bot APAGADOS (el código dice «encendida por defecto»):
-- por eso el cliente no veía dónde poner propina. Se enciende la carta SOLO si el parámetro sigue siendo
-- exactamente esa semilla (nadie lo tocó desde Configuración). El bot sigue como está.
UPDATE "parametro"
SET "valor" = '{"carta": true, "bot": false}'::jsonb
WHERE "clave" = 'propina_activa' AND "valor" = '{"carta": false, "bot": false}'::jsonb;
