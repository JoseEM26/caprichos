-- DÚO SIN SABORES PROPIOS: un producto que es ANFITRIÓN de una oferta COMBO (oferta.tipo = 'COMBO' con
-- alcance_producto_id) se arma con los grupos del combo; no se vende por mezcla de sabores propia.
-- Los productos se buscan por ser anfitrión de un combo (join oferta.alcance_producto_id), NUNCA por nombre ni id.
--
-- (a) Sabores propios del anfitrión:
--     - se quitan las filas de stock_sabor, agotado y conteo_apertura de esos sabores (son saldo, no historial);
--     - los sabores SIN historial (pedido_linea_sabor, movimiento_stock, cortesia) se BORRAN;
--     - los sabores CON historial se DESACTIVAN (activo = false) para no perder los pedidos viejos.
-- (b) Opciones de sabor de galleta en los grupos «Galleta…» ligados a esos anfitriones: «Choco chips»,
--     «Avena y pasas» y «Red velvet» (lista_valor.nombre, sin distinguir mayúsculas). Sin historial
--     (pedido_linea_opcion, agotado, ajuste_opcion) se BORRAN; con historial se DESACTIVAN (activo = false).
--     Un grupo que se queda sin opciones activas no bloquea el combo (la carta y el pedido lo ignoran).
--     El complemento «2 Galletas choco chips» es otra opción (otro valor) y no se toca.
-- Idempotente: una segunda ejecución no encuentra nada que cambiar. Si no hay anfitriones o nada que tocar,
-- no hace nada ni falla. No crea tablas ni columnas. Todo va en un único bloque DO (una transacción).

DO $$
DECLARE
  v_anfitriones BIGINT[];
  v_sabores BIGINT[];
  v_sabores_con_historial BIGINT[];
  v_opciones BIGINT[];
  v_opciones_con_historial BIGINT[];
  v_sabores_borrados INTEGER := 0;
  v_sabores_desactivados INTEGER := 0;
  v_opciones_borradas INTEGER := 0;
  v_opciones_desactivadas INTEGER := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT o.alcance_producto_id), '{}'::BIGINT[]) INTO v_anfitriones
  FROM oferta o
  WHERE o.tipo = 'COMBO' AND o.alcance_producto_id IS NOT NULL;

  IF cardinality(v_anfitriones) = 0 THEN
    RAISE NOTICE 'duo_sin_sabores_propios: no hay productos anfitriones de combo, no se hace nada';
    RETURN;
  END IF;

  -- (a) Sabores propios de los anfitriones
  SELECT COALESCE(array_agg(s.id), '{}'::BIGINT[]) INTO v_sabores
  FROM sabor s
  WHERE s.producto_id = ANY(v_anfitriones);

  IF cardinality(v_sabores) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT h.x), '{}'::BIGINT[]) INTO v_sabores_con_historial
    FROM (
      SELECT pls.sabor_id AS x FROM pedido_linea_sabor pls WHERE pls.sabor_id = ANY(v_sabores)
      UNION
      SELECT ms.sabor_id AS x FROM movimiento_stock ms WHERE ms.sabor_id = ANY(v_sabores)
      UNION
      SELECT c.sabor_id AS x FROM cortesia c WHERE c.sabor_id = ANY(v_sabores)
    ) h;

    -- Lo que cuelga del sabor y es saldo o estado actual: se quita
    DELETE FROM stock_sabor WHERE sabor_id = ANY(v_sabores);
    DELETE FROM agotado WHERE sabor_id = ANY(v_sabores);
    DELETE FROM conteo_apertura WHERE sabor_id = ANY(v_sabores);

    -- Sin historial: se borra la fila de sabor
    DELETE FROM sabor
    WHERE id = ANY(v_sabores)
      AND id <> ALL(v_sabores_con_historial);
    GET DIAGNOSTICS v_sabores_borrados = ROW_COUNT;

    -- Con historial: se desactiva (no aparece para elegir, los pedidos viejos quedan íntegros)
    UPDATE sabor SET activo = false
    WHERE id = ANY(v_sabores_con_historial) AND activo = true;
    GET DIAGNOSTICS v_sabores_desactivados = ROW_COUNT;
  END IF;

  -- (b) Opciones de sabor de galleta en los grupos «Galleta…» de los anfitriones
  SELECT COALESCE(array_agg(DISTINCT o.id), '{}'::BIGINT[]) INTO v_opciones
  FROM opcion o
  JOIN lista_valor lv ON lv.id = o.valor_id
  JOIN grupo_opciones g ON g.id = o.grupo_id
  JOIN producto_grupo pg ON pg.grupo_id = g.id
  WHERE pg.producto_id = ANY(v_anfitriones)
    AND lower(trim(g.nombre)) LIKE 'galleta%'
    AND lower(trim(lv.nombre)) IN ('choco chips', 'avena y pasas', 'red velvet');

  IF cardinality(v_opciones) > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT h.x), '{}'::BIGINT[]) INTO v_opciones_con_historial
    FROM (
      SELECT plo.opcion_id AS x FROM pedido_linea_opcion plo WHERE plo.opcion_id = ANY(v_opciones)
      UNION
      SELECT a.opcion_id AS x FROM agotado a WHERE a.opcion_id = ANY(v_opciones)
      UNION
      SELECT ao.opcion_id AS x FROM ajuste_opcion ao WHERE ao.opcion_id = ANY(v_opciones)
    ) h;

    DELETE FROM opcion
    WHERE id = ANY(v_opciones)
      AND id <> ALL(v_opciones_con_historial);
    GET DIAGNOSTICS v_opciones_borradas = ROW_COUNT;

    UPDATE opcion SET activo = false
    WHERE id = ANY(v_opciones_con_historial) AND activo = true;
    GET DIAGNOSTICS v_opciones_desactivadas = ROW_COUNT;
  END IF;

  RAISE NOTICE 'duo_sin_sabores_propios: sabores borrados %, desactivados %; opciones de galleta borradas %, desactivadas %',
    v_sabores_borrados, v_sabores_desactivados, v_opciones_borradas, v_opciones_desactivadas;
END $$;
