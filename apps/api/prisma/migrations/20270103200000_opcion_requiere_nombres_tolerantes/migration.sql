-- OPCIÓN QUE REQUIERE STOCK: completar vínculos con coincidencia TOLERANTE de nombres.
-- La migración 20270103100000 emparejó por nombre exacto (lower/trim). En producción los nombres difieren
-- (p. ej. «GALLETA CHOCOCHIPS» en vez de «GALLETA CHOCO CHIPS», «EMPANADA ARTESANAL», «PETIT PAN RELLENO DE POLLO»).
-- Esta migración añade SOLO los vínculos que faltan, dentro de los grupos de productos ANFITRIONES de COMBO.
--
-- Normalización (todo lo que no es letra o número se quita, sin tildes, en minúsculas):
--   «GALLETA CHOCOCHIPS» = «Galleta choco chips» = «galletachocochips».
--
-- Reglas (cada una inserta con ON CONFLICT DO NOTHING; nunca duplica un vínculo ya existente):
--   R1  «2 Donas»                    -> DONAS ARTESANALES x2
--   R2  «2 Galletas choco chips»     -> galleta choco chips x2
--   R3  «1 Dona + 1 Galleta»         -> DONAS ARTESANALES x1 + galleta choco chips x1
--   R4  «1 X» o «X» con producto de nombre normalizado igual a X (sin el «1» inicial), x1
--   R5  nombre normalizado que empieza igual que un ÚNICO producto («carrot cake», «petit pan»), x1 (o N de «Bandeja de N»)
--   R6  «Empanada…» sin vínculos previos: producto EMPANADA… único + su sabor con la palabra clave (jamón, pollo)
--   R7  sabores de los grupos «Dona N · Sabor»: el sabor de DONAS ARTESANALES con el mismo nombre, x1
-- Si un producto no existe, no inserta nada (nunca falla). Idempotente: una segunda ejecución no inserta nada.
-- Tabla y índices ya existen (20270103100000). No cambia datos existentes ni borra nada.

CREATE OR REPLACE FUNCTION pg_temp.norm_nombre(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(translate(lower(COALESCE(t, '')), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g')
$$;

WITH anfitriones AS (
  SELECT DISTINCT ofe.alcance_producto_id AS producto_id
  FROM oferta ofe
  WHERE ofe.tipo = 'COMBO' AND ofe.alcance_producto_id IS NOT NULL
),
oh AS (
  -- Opciones de los grupos ligados a un anfitrión de combo, con su nombre normalizado y el del grupo
  SELECT DISTINCT o.id AS opcion_id,
         pg_temp.norm_nombre(lv.nombre) AS n,
         CASE WHEN pg_temp.norm_nombre(lv.nombre) ~ '^1[a-z]' THEN substring(pg_temp.norm_nombre(lv.nombre) FROM 2)
              ELSE pg_temp.norm_nombre(lv.nombre) END AS sin_uno,
         lower(trim(g.nombre)) AS grupo_n,
         lv.nombre AS nombre
  FROM opcion o
  JOIN lista_valor lv ON lv.id = o.valor_id
  JOIN grupo_opciones g ON g.id = o.grupo_id
  JOIN producto_grupo pg ON pg.grupo_id = g.id
  WHERE pg.producto_id IN (SELECT producto_id FROM anfitriones)
),
pn AS (
  -- Productos con su nombre normalizado
  SELECT p.id, p.nombre, pg_temp.norm_nombre(p.nombre) AS n FROM producto p
),
donas AS (SELECT id FROM pn WHERE n = 'donasartesanales'),
galletas AS (SELECT id FROM pn WHERE n = 'galletachocochips'),
req AS (
  -- R1 · 2 Donas
  SELECT oh.opcion_id, d.id AS producto_id, NULL::BIGINT AS sabor_id, 2 AS cantidad
  FROM oh CROSS JOIN donas d WHERE oh.n = '2donas'
  UNION ALL
  -- R2 · 2 Galletas choco chips
  SELECT oh.opcion_id, g.id, NULL::BIGINT, 2
  FROM oh CROSS JOIN galletas g WHERE oh.n = '2galletaschocochips'
  UNION ALL
  -- R3 · 1 Dona + 1 Galleta
  SELECT oh.opcion_id, d.id, NULL::BIGINT, 1 FROM oh CROSS JOIN donas d WHERE oh.n = '1dona1galleta'
  UNION ALL
  SELECT oh.opcion_id, g.id, NULL::BIGINT, 1 FROM oh CROSS JOIN galletas g WHERE oh.n = '1dona1galleta'
  UNION ALL
  -- R4 · producto de nombre igual (sin el «1» inicial)
  SELECT oh.opcion_id, p.id, NULL::BIGINT, 1
  FROM oh JOIN pn p ON p.n = oh.sin_uno
  WHERE oh.n NOT IN ('2donas', '2galletaschocochips', '1dona1galleta')
    AND oh.grupo_n NOT LIKE 'dona%sabor%'
  UNION ALL
  -- R5a · «Bandeja de N Petit Pan»: el único producto que empieza por «petitpan», N unidades (1 si no hay N)
  SELECT oh.opcion_id, p.id, NULL::BIGINT,
         COALESCE(NULLIF((regexp_match(oh.n, '^bandejade(\d+)'))[1], '')::INT, 1)
  FROM oh JOIN pn p ON p.n LIKE 'petitpan%'
  WHERE oh.n LIKE '%petitpan%'
    AND oh.grupo_n NOT LIKE 'dona%sabor%'
    AND (SELECT count(*) FROM pn WHERE pn.n LIKE 'petitpan%') = 1
  UNION ALL
  -- R5b · prefijo único de producto (p. ej. «carrotcake» → CARROT CAKE), x1
  SELECT oh.opcion_id, p.id, NULL::BIGINT, 1
  FROM oh JOIN pn p ON p.n LIKE oh.sin_uno || '%'
  WHERE length(oh.sin_uno) >= 6
    AND oh.n NOT IN ('2donas', '2galletaschocochips', '1dona1galleta')
    AND oh.grupo_n NOT LIKE 'dona%sabor%'
    AND oh.n NOT LIKE '%petitpan%'
    AND (SELECT count(*) FROM pn WHERE pn.n LIKE oh.sin_uno || '%') = 1
  UNION ALL
  -- R6 · «Empanada…» sin vínculos previos: producto EMPANADA… único y su sabor con la palabra clave
  SELECT oh.opcion_id, e.id, s.id, 1
  FROM oh
  JOIN pn e ON e.n LIKE 'empanada%'
  JOIN sabor s ON s.producto_id = e.id
  WHERE oh.n LIKE '%empanada%'
    AND oh.grupo_n NOT LIKE 'dona%sabor%'
    AND NOT EXISTS (SELECT 1 FROM opcion_requiere r WHERE r.opcion_id = oh.opcion_id)
    AND (SELECT count(*) FROM pn WHERE pn.n LIKE 'empanada%') = 1
    AND ((oh.n LIKE '%jamon%' AND pg_temp.norm_nombre(s.nombre) LIKE '%jamon%')
      OR (oh.n LIKE '%pollo%' AND pg_temp.norm_nombre(s.nombre) LIKE '%pollo%'))
  UNION ALL
  -- R7 · sabores de «Dona N · Sabor» = sabor de DONAS ARTESANALES con el mismo nombre normalizado
  SELECT oh.opcion_id, d.id, s.id, 1
  FROM oh
  CROSS JOIN donas d
  JOIN sabor s ON s.producto_id = d.id AND pg_temp.norm_nombre(s.nombre) = oh.n
  WHERE oh.grupo_n LIKE 'dona%sabor%'
)
INSERT INTO "opcion_requiere" ("opcion_id", "producto_id", "sabor_id", "cantidad")
SELECT DISTINCT r.opcion_id, r.producto_id, r.sabor_id, r.cantidad FROM req r
ON CONFLICT DO NOTHING;
