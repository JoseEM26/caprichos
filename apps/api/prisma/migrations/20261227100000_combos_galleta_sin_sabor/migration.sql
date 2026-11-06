-- COMBOS DÚO: la galleta del combo ya no tiene sabores (migración 20261226100000). Quita de los grupos de
-- galleta de los combos Dúo las opciones de sabor que quedaron: «Choco chips», «Avena y pasas» y «Red velvet».
--
-- Alcance: solo grupos de opciones cuyo nombre empieza por «Galleta» y que están vinculados a los productos
-- DÚO PARA COMPARTIR o DÚO IRRESISTIBLE (por nombre exacto sin distinguir mayúsculas, nunca por id).
-- Las opciones de las donas, de los grupos de otros productos y los grupos mismos no se tocan.
-- Por cada opción: si no tiene historial (pedidos, agotados o ajustes de insumo), se BORRA; si lo tiene, se DESACTIVA
-- (activo = false) para no perder los pedidos viejos.
-- Idempotente: una segunda ejecución no encuentra nada. Si los nombres no existen, no hace nada.
-- Todo va en un único bloque DO: una sola sentencia, por tanto una sola transacción (atómica).

DO $$
DECLARE
  v_opciones BIGINT[];
  v_con_historial BIGINT[];
  v_quitadas INTEGER := 0;
  v_desactivadas INTEGER := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT o.id), '{}'::BIGINT[]) INTO v_opciones
  FROM opcion o
  JOIN grupo_opciones g ON g.id = o.grupo_id
  JOIN producto_grupo pg ON pg.grupo_id = g.id
  JOIN producto p ON p.id = pg.producto_id
  WHERE upper(trim(p.nombre)) IN ('DÚO PARA COMPARTIR', 'DUO PARA COMPARTIR', 'DÚO IRRESISTIBLE', 'DUO IRRESISTIBLE')
    AND lower(trim(g.nombre)) LIKE 'galleta%'
    AND lower(trim(o.nombre)) IN ('choco chips', 'avena y pasas', 'red velvet');

  IF cardinality(v_opciones) = 0 THEN
    RAISE NOTICE 'combos_galleta_sin_sabor: no hay opciones de sabor de galleta en los combos Dúo, no se hace nada';
    RETURN;
  END IF;

  -- Opciones con historial de pedidos o de sabores: no se borran, se desactivan
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::BIGINT[]) INTO v_con_historial
  FROM (
    SELECT opcion_id AS x FROM pedido_linea_opcion WHERE opcion_id = ANY(v_opciones)
    UNION
    SELECT opcion_id AS x FROM agotado WHERE opcion_id = ANY(v_opciones)
    UNION
    SELECT opcion_id AS x FROM ajuste_opcion WHERE opcion_id = ANY(v_opciones)
  ) h;

  -- Se quitan del grupo las que no tienen historial (borrado de la fila de opción)
  DELETE FROM opcion
  WHERE id = ANY(v_opciones)
    AND id <> ALL(v_con_historial);
  GET DIAGNOSTICS v_quitadas = ROW_COUNT;

  -- Las que tienen historial quedan desactivadas (no aparecen para elegir)
  UPDATE opcion SET activo = false
  WHERE id = ANY(v_con_historial) AND activo = true;
  GET DIAGNOSTICS v_desactivadas = ROW_COUNT;

  RAISE NOTICE 'combos_galleta_sin_sabor: opciones quitadas %, desactivadas %', v_quitadas, v_desactivadas;
END $$;
