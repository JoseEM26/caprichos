-- Tamano de los stickers de la etiquetera, en milimetros (aditivo, idempotente).
-- Bebida 76 x 38 mm y general 100 x 100 mm. ON CONFLICT DO NOTHING: no pisa lo que el dueno ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_etiqueta_bebida_ancho_mm', '76'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_etiqueta_bebida_alto_mm', '38'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_etiqueta_general_ancho_mm', '100'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('impresion_etiqueta_general_alto_mm', '100'::jsonb) ON CONFLICT ("clave") DO NOTHING;
