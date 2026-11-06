-- Tamaño por parte de combo: combo_parte.tamano_id apunta a producto_tamano (producto + tamaño).
-- Lo usan las partes FIJO de un solo producto; la línea hija de cocina sale con ese tamaño (comanda, etiqueta, stock).
--
-- Idempotente y aditiva. Columna nullable: las partes existentes quedan sin tamaño hasta que el ADMIN lo elija.
-- Si se borra el producto_tamano, la parte queda sin tamaño (ON DELETE SET NULL).
-- Único dato fijado: la parte FIJO «FRAPPE OREO» del combo «COMBO CAJITA CAPRIKIDS» toma el tamaño «Regular 12 oz».
-- Todo se busca por nombre exacto (sin distinguir mayúsculas), nunca por id. Si algo no existe, no se toca.

ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "tamano_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'combo_parte_tamano_id_fkey'
  ) THEN
    ALTER TABLE "combo_parte"
      ADD CONSTRAINT "combo_parte_tamano_id_fkey"
      FOREIGN KEY ("tamano_id") REFERENCES "producto_tamano"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE combo_parte cp
SET tamano_id = pt.id
FROM oferta o, producto p, producto_tamano pt, lista_valor lv, lista l
WHERE cp.oferta_id = o.id
  AND lower(o.nombre) = lower('COMBO CAJITA CAPRIKIDS')
  AND cp.tipo = 'FIJO'
  AND cp.tamano_id IS NULL
  AND cp.productos = ARRAY[p.id]::BIGINT[]
  AND lower(p.nombre) = lower('FRAPPE OREO')
  AND pt.producto_id = p.id
  AND pt.tamano_valor_id = lv.id
  AND lower(lv.nombre) = lower('Regular 12 oz')
  AND lv.lista_id = l.id
  AND l.codigo = 'TAMANO';
