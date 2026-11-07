-- ORIGEN DEL AGOTADO: MANUAL vs AUTOMATICO (aditiva e idempotente)
--
-- MANUAL     = alguien lo apagó a propósito (Productos, Cocina › Agotados): solo se quita a mano.
-- AUTOMATICO = lo apagó el sistema por saldo 0 de un producto/sabor con «Controlar stock»: vuelve solo al reponer o abrir.
-- Opciones: solo se agotan a mano, no llevan columna. NULL en una fila agotada se lee como MANUAL (lo más seguro).
--
-- REGLA PARA LOS DATOS EXISTENTES (solo filas con origen NULL, así la migración se puede repetir):
--   producto agotado (agotado_hasta futuro): AUTOMATICO solo si controla_stock, no tiene sabores activos y su saldo
--     total en stock es <= 0 (es el caso que el sistema apaga solo). Todo lo demás, MANUAL: no se reactiva nada
--     que alguien haya apagado a propósito. Un agotado por receta/insumo no se puede reconocer y queda MANUAL.
--   sabor agotado: AUTOMATICO solo si su producto controla_stock y su stock_sabor es <= 0; si no, MANUAL.
--   agotado (historial abierto, reactivado_en NULL): hereda el origen de su producto/sabor; opciones, MANUAL.

ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "agotado_origen" TEXT;
ALTER TABLE "sabor"    ADD COLUMN IF NOT EXISTS "agotado_origen" TEXT;
ALTER TABLE "agotado"  ADD COLUMN IF NOT EXISTS "origen" TEXT;

UPDATE "producto" p SET "agotado_origen" = CASE
  WHEN p."controla_stock"
   AND NOT EXISTS (SELECT 1 FROM "sabor" s WHERE s."producto_id" = p."id" AND s."activo")
   AND COALESCE((SELECT SUM(st."cantidad") FROM "stock" st WHERE st."producto_id" = p."id"), 0) <= 0
  THEN 'AUTOMATICO' ELSE 'MANUAL' END
WHERE p."agotado_hasta" IS NOT NULL AND p."agotado_origen" IS NULL;

UPDATE "sabor" s SET "agotado_origen" = CASE
  WHEN EXISTS (SELECT 1 FROM "producto" p WHERE p."id" = s."producto_id" AND p."controla_stock")
   AND EXISTS (SELECT 1 FROM "stock_sabor" ss WHERE ss."sabor_id" = s."id" AND ss."cantidad" <= 0)
  THEN 'AUTOMATICO' ELSE 'MANUAL' END
WHERE s."agotado_hasta" IS NOT NULL AND s."agotado_origen" IS NULL;

UPDATE "agotado" a SET "origen" = COALESCE(
  (SELECT p."agotado_origen" FROM "producto" p WHERE p."id" = a."producto_id"),
  (SELECT s."agotado_origen" FROM "sabor" s WHERE s."id" = a."sabor_id"),
  'MANUAL')
WHERE a."reactivado_en" IS NULL AND a."origen" IS NULL;

UPDATE "agotado" SET "origen" = 'MANUAL' WHERE "origen" IS NULL AND "reactivado_en" IS NOT NULL;

ALTER TABLE "producto" DROP CONSTRAINT IF EXISTS "producto_agotado_origen_check";
ALTER TABLE "producto" ADD CONSTRAINT "producto_agotado_origen_check" CHECK ("agotado_origen" IS NULL OR "agotado_origen" IN ('MANUAL', 'AUTOMATICO'));
ALTER TABLE "sabor" DROP CONSTRAINT IF EXISTS "sabor_agotado_origen_check";
ALTER TABLE "sabor" ADD CONSTRAINT "sabor_agotado_origen_check" CHECK ("agotado_origen" IS NULL OR "agotado_origen" IN ('MANUAL', 'AUTOMATICO'));
ALTER TABLE "agotado" DROP CONSTRAINT IF EXISTS "agotado_origen_check";
ALTER TABLE "agotado" ADD CONSTRAINT "agotado_origen_check" CHECK ("origen" IS NULL OR "origen" IN ('MANUAL', 'AUTOMATICO'));
