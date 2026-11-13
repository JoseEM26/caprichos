-- Alérgenos libres: además de los 8 códigos fijos, el producto puede llevar otros en texto (lúcuma, fresa…).
-- El CHECK de valores fijos se cambia por uno que solo limita tamaño. Idempotente.
CREATE OR REPLACE FUNCTION producto_alergenos_validos(a TEXT[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(cardinality(a), 0) <= 20
     AND NOT EXISTS (SELECT 1 FROM unnest(a) AS x WHERE x IS NULL OR char_length(x) NOT BETWEEN 1 AND 30)
$$;
ALTER TABLE "producto" DROP CONSTRAINT IF EXISTS "producto_alergenos_chk";
ALTER TABLE "producto" DROP CONSTRAINT IF EXISTS "producto_alergenos_tamano_chk";
ALTER TABLE "producto" ADD CONSTRAINT "producto_alergenos_tamano_chk" CHECK (producto_alergenos_validos("alergenos"));
