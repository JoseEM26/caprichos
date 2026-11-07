-- Decisión del dueño (08/11/2026): en el local (mesa) NO sale ningún sticker; solo llevar, recoger y delivery.
-- Quita MESA y LOCAL de las modalidades de los stickers de bebida, de área y general si alguien las dejó.
-- Idempotente: solo toca filas que todavía las tienen; lo demás que el dueño cambió a mano queda igual.
UPDATE "parametro"
SET "valor" = COALESCE(
  (SELECT jsonb_agg(e) FROM jsonb_array_elements("valor") AS e WHERE (e #>> '{}') NOT IN ('MESA', 'LOCAL')),
  '[]'::jsonb
)
WHERE "clave" IN (
    'impresion_etiqueta_bebida_modalidades',
    'impresion_etiqueta_area_modalidades',
    'impresion_etiqueta_general_modalidades'
  )
  AND jsonb_typeof("valor") = 'array'
  AND ("valor" ? 'MESA' OR "valor" ? 'LOCAL');
