-- Quita el producto «1/2 DOCENA DONUTS O GALLETAS» (combo aparte, S/ 21). La media docena
-- ya es un tamaño de DONAS ARTESANALES y de GALLETA CHOCO CHIPS.
--
-- Se busca por nombre exacto sin distinguir mayúsculas (nunca por id). Si no existe, no hace nada.
-- Todo va en un único bloque DO: una sola sentencia, por tanto una sola transacción (atómica).
--
-- Camino A (sin historial: ni pedido_linea, ni movimiento_stock, ni producción, ni ranking_mes):
--   se BORRA el producto y sus dependencias (receta y líneas, stock, conteos de apertura,
--   agotados, sabores, grupos de opciones, tamaños, reemplazos de combo). Las ofertas y cupones
--   que lo usaban de alcance se desactivan y su alcance pasa a NULL.
--
-- Camino B (con historial de pedidos o de stock): NO se borra. Se OCULTA (oculto = true), se
--   desactivan sus tamaños, y se quita de las ofertas: los reemplazos se borran, las ofertas
--   con alcance en él se desactivan, y cada parte de combo pierde el id. Si una parte queda sin
--   productos ni categorías, su oferta se desactiva (no se deja un combo roto).
--
-- Efectos sobre combos (ambos caminos): si una oferta queda sin partes válidas, se desactiva
-- (activo = false y visible_carta = false), igual que la migración 20261219100000.
--
-- Los archivos de foto (archivo) no se borran: pueden estar compartidos y no se sabe si lo están.

DO $$
DECLARE
  v_ids BIGINT[];
  v_historial BOOLEAN;
  v_ofertas BIGINT[];
BEGIN
  SELECT array_agg(id) INTO v_ids
  FROM producto
  WHERE lower(nombre) = lower('1/2 DOCENA DONUTS O GALLETAS');

  IF v_ids IS NULL THEN
    RAISE NOTICE 'quitar_producto_media_docena: no existe el producto, no se hace nada';
    RETURN;
  END IF;

  v_historial :=
       EXISTS (SELECT 1 FROM pedido_linea WHERE producto_id = ANY(v_ids))
    OR EXISTS (SELECT 1 FROM movimiento_stock WHERE producto_id = ANY(v_ids))
    OR EXISTS (SELECT 1 FROM produccion p JOIN receta r ON r.id = p.receta_id WHERE r.producto_id = ANY(v_ids))
    OR EXISTS (SELECT 1 FROM ranking_mes WHERE producto_id = ANY(v_ids));

  -- Partes de combo: quitar el producto de la lista de opciones. Las ofertas cuyas partes quedan vacías se apagan.
  WITH quitados AS (
    UPDATE combo_parte
    SET productos = ARRAY(SELECT x FROM unnest(productos) AS x WHERE x <> ALL(v_ids))
    WHERE productos && v_ids
    RETURNING oferta_id
  )
  SELECT array_agg(DISTINCT oferta_id) INTO v_ofertas FROM quitados;

  DELETE FROM combo_parte_reemplazo WHERE producto_id = ANY(v_ids);

  UPDATE oferta
  SET activo = false, visible_carta = false
  WHERE activo AND id = ANY(COALESCE(v_ofertas, '{}'::BIGINT[]))
    AND EXISTS (
      SELECT 1 FROM combo_parte p
      WHERE p.oferta_id = oferta.id
        AND COALESCE(cardinality(p.productos), 0) = 0
        AND COALESCE(cardinality(p.categorias), 0) = 0
    );

  -- Ofertas y cupones con alcance en el producto: no pueden aplicarse más.
  UPDATE oferta SET activo = false, visible_carta = false WHERE alcance_producto_id = ANY(v_ids);
  UPDATE cupon SET activo = false WHERE producto_id = ANY(v_ids);

  IF v_historial THEN
    RAISE NOTICE 'quitar_producto_media_docena: tiene historial, se oculta (camino B)';
    UPDATE producto SET oculto = true WHERE id = ANY(v_ids);
    UPDATE producto_tamano SET activo = false WHERE producto_id = ANY(v_ids);
  ELSE
    RAISE NOTICE 'quitar_producto_media_docena: sin historial, se borra (camino A)';
    UPDATE oferta SET alcance_producto_id = NULL WHERE alcance_producto_id = ANY(v_ids);
    UPDATE cupon SET producto_id = NULL WHERE producto_id = ANY(v_ids);

    DELETE FROM receta_linea WHERE receta_id IN (SELECT id FROM receta WHERE producto_id = ANY(v_ids));
    UPDATE receta_linea SET producto_tamano_id = NULL
      WHERE producto_tamano_id IN (SELECT id FROM producto_tamano WHERE producto_id = ANY(v_ids));
    DELETE FROM receta WHERE producto_id = ANY(v_ids);

    DELETE FROM agotado WHERE producto_id = ANY(v_ids)
      OR sabor_id IN (SELECT id FROM sabor WHERE producto_id = ANY(v_ids));
    DELETE FROM stock WHERE producto_id = ANY(v_ids);
    DELETE FROM conteo_apertura WHERE producto_id = ANY(v_ids);
    DELETE FROM sabor WHERE producto_id = ANY(v_ids);
    DELETE FROM producto_grupo WHERE producto_id = ANY(v_ids);
    DELETE FROM producto_tamano WHERE producto_id = ANY(v_ids);
    DELETE FROM producto WHERE id = ANY(v_ids);
  END IF;
END $$;
