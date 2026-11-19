-- Avisos de stock por cruce: el insumo guarda en qué nivel de alerta está (NULL = normal, POR_PEDIR o AGOTADO).
-- Un aviso sale solo al cambiar de nivel; al reponerse por encima del umbral vuelve a NULL y se re-arma.
ALTER TABLE "insumo" ADD COLUMN "alerta_stock" TEXT;

-- Porcentaje del máximo que marca el umbral de «por pedir» (1 a 100). Por defecto 20.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('stock_alerta_porcentaje', '20'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
