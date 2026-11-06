-- GALLETA CHOCO CHIPS ya no tiene sabores: las galletas son solo galletas, con un único stock por producto.
--
-- Se busca el producto por nombre exacto sin distinguir mayúsculas (nunca por id). Si no existe, no hace nada.
-- Por cada sabor del producto:
--   · Se borra su saldo (stock_sabor), sus conteos de apertura (conteo_apertura con sabor_id) y sus agotados.
--   · Si no tiene historial (pedido_linea_sabor ni movimiento_stock), se BORRA el sabor.
--   · Si tiene historial, NO se borra (fallaría por las llaves foráneas y se perdería el historial): se
--     DESACTIVA (activo = false) y se conserva el historial.
-- Sin sabores activos, el producto controla stock por PRODUCTO (saldo único en stock). Ese saldo no se toca:
-- no se inventan cifras.
-- Es idempotente: una segunda ejecución no encuentra nada que borrar ni cambiar.
-- Todo va en un único bloque DO: una sola sentencia, por tanto una sola transacción (atómica).

DO $$
DECLARE
  v_productos BIGINT[];
  v_sabores BIGINT[];
  v_con_historial BIGINT[];
BEGIN
  SELECT array_agg(id) INTO v_productos
  FROM producto
  WHERE lower(nombre) = lower('GALLETA CHOCO CHIPS');

  IF v_productos IS NULL THEN
    RAISE NOTICE 'galletas_sin_sabores: no existe el producto GALLETA CHOCO CHIPS, no se hace nada';
    RETURN;
  END IF;

  SELECT array_agg(id) INTO v_sabores
  FROM sabor
  WHERE producto_id = ANY(v_productos);

  IF v_sabores IS NULL THEN
    RAISE NOTICE 'galletas_sin_sabores: el producto ya no tiene sabores';
    RETURN;
  END IF;

  -- Sabores con historial de pedidos o de movimientos de stock: no se borran, se desactivan
  SELECT COALESCE(array_agg(DISTINCT s), '{}'::BIGINT[]) INTO v_con_historial
  FROM (
    SELECT sabor_id AS s FROM pedido_linea_sabor WHERE sabor_id = ANY(v_sabores)
    UNION
    SELECT sabor_id AS s FROM movimiento_stock WHERE sabor_id = ANY(v_sabores)
  ) h;

  -- Saldo viejo por sabor (no se reparte ni se adivina: se quita; el saldo del producto queda como está)
  DELETE FROM stock_sabor WHERE sabor_id = ANY(v_sabores);

  -- Conteos de apertura y agotados de cada sabor
  DELETE FROM conteo_apertura WHERE sabor_id = ANY(v_sabores);
  DELETE FROM agotado WHERE sabor_id = ANY(v_sabores);

  -- Sabores sin historial: se borran (ya no les cuelga nada que impida hacerlo)
  DELETE FROM sabor
  WHERE id = ANY(v_sabores)
    AND id <> ALL(v_con_historial);

  -- Sabores con historial: se desactivan y conservan sus pedidos y movimientos
  UPDATE sabor
  SET activo = false, agotado_hasta = NULL
  WHERE id = ANY(v_con_historial);

  RAISE NOTICE 'galletas_sin_sabores: sabores revisados %, con historial desactivados %',
    cardinality(v_sabores), cardinality(v_con_historial);
END $$;
