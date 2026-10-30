-- Parámetros del tiempo estimado de entrega (solo parámetros, aditivo, idempotente).
-- eta_factor_urbano: multiplica la distancia por calles (1.3 = 30 % más que la línea recta).
-- eta_productos_desde / eta_extra_por_producto_min: a partir de cuántas unidades se suma empaque y cuántos minutos por unidad.
-- eta_parada_min: minutos por cada pedido anterior que el repartidor lleva en la ruta.
-- eta_margen_min: ancho mínimo del rango (max = min + margen).
-- eta_paso_min: redondeo del rango a múltiplos de este valor.
-- eta_base_sin_zona_min: minutos de puerta cuando solo hay coordenadas y no hay zona.
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_factor_urbano', '1.3'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_productos_desde', '3'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_extra_por_producto_min', '1'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_parada_min', '3'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_margen_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_paso_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('eta_base_sin_zona_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
