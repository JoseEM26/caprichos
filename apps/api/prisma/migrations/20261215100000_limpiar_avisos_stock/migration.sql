-- Control de almacén apagado: los avisos de stock (agotado / por pedir) ya no se generan.
-- Los que quedaron de antes se marcan como leídos (no se borran) solo si el control está apagado:
-- sin parámetro stock_control_activo, o con un valor distinto de «si» / true.
UPDATE "notificacion" AS n
SET "leida_en" = CURRENT_TIMESTAMP
WHERE n."leida_en" IS NULL
  AND n."tipo" = 'ALERTA_INTERNA'
  AND n."titulo" LIKE 'Alerta de Stock: %'
  AND NOT EXISTS (
    SELECT 1
    FROM "parametro" p
    WHERE p."clave" = 'stock_control_activo'
      AND lower(trim(p."valor" #>> '{}')) IN ('si', 'true')
  );
