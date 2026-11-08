-- Partes de combo más finas, para el editor por toques:
--  * sabores_ids: sabores permitidos en la parte (donas, galletas por sabor). Vacío = todos los sabores.
--  * productos_excluidos_ids: productos que NO entran aunque su categoría sí (p. ej. quitar Frozen o un producto).
-- Aditiva e idempotente: con el valor por defecto (lista vacía) los combos existentes no cambian.

ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "sabores_ids" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[];
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "productos_excluidos_ids" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[];
