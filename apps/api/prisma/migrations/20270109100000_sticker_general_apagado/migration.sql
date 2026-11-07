-- Sticker GENERAL («todo el pedido») apagado: el dueño ya no lo imprime (07/11/2026).
-- Lista de modalidades vacía = no sale en ninguna. El código no se borra: se reactiva en Configuración › Impresión › Mapa.
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_etiqueta_general_modalidades', '[]'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = '[]'::jsonb;
