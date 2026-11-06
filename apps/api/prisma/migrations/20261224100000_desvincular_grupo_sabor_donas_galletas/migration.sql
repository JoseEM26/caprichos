-- Desvincula el grupo de opciones heredado «Sabor» de DONAS ARTESANALES y GALLETA CHOCO CHIPS.
-- Ese grupo (obligatorio, con opciones de empanada) bloqueaba el pedido; ahora el sabor se elige
-- con el stock por sabor (tabla sabor).
--
-- Solo se borra la fila de producto_grupo (el vínculo). El grupo en sí y sus opciones no se tocan,
-- y EMPANADA ARTESANAL no se modifica. Solo se desvincula si el producto ya tiene sabores activos:
-- sin sabores propios se deja como estaba. Es idempotente: si no hay filas que borrar, no hace nada.

DELETE FROM producto_grupo pg
USING producto p, grupo_opciones g
WHERE pg.producto_id = p.id
  AND pg.grupo_id = g.id
  AND lower(trim(g.nombre)) = 'sabor'
  AND upper(trim(p.nombre)) IN ('DONAS ARTESANALES', 'GALLETA CHOCO CHIPS')
  AND EXISTS (
    SELECT 1
    FROM sabor s
    WHERE s.producto_id = p.id
      AND s.activo = true
  );
