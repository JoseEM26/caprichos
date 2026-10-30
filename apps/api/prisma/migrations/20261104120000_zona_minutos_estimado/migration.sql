-- Minutos típicos de entrega por zona (aditivo). El rango del aviso «Tiempo estimado» sale de aquí
-- más el recorrido y el empaque; si la zona no tiene minutos, se usa el cálculo con coordenadas o tiempo_prometido_min.
ALTER TABLE "zona_reparto" ADD COLUMN IF NOT EXISTS "minutos_min" INTEGER;
ALTER TABLE "zona_reparto" ADD COLUMN IF NOT EXISTS "minutos_max" INTEGER;
-- Valores por defecto según la distancia real de cada polígono al local (Z2 la más cercana, Z7 la más lejana).
-- Solo se llenan las zonas que aún no tienen minutos: no pisa lo que el dueño ya haya editado.
UPDATE "zona_reparto" SET "minutos_min" = 10, "minutos_max" = 15 WHERE "codigo" = 'Z2' AND "minutos_min" IS NULL;
UPDATE "zona_reparto" SET "minutos_min" = 15, "minutos_max" = 20 WHERE "codigo" = 'Z3' AND "minutos_min" IS NULL;
UPDATE "zona_reparto" SET "minutos_min" = 20, "minutos_max" = 25 WHERE "codigo" = 'Z4' AND "minutos_min" IS NULL;
UPDATE "zona_reparto" SET "minutos_min" = 25, "minutos_max" = 30 WHERE "codigo" = 'Z5' AND "minutos_min" IS NULL;
UPDATE "zona_reparto" SET "minutos_min" = 30, "minutos_max" = 40 WHERE "codigo" = 'Z7' AND "minutos_min" IS NULL;
