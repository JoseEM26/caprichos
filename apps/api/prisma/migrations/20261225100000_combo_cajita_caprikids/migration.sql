-- Combo «COMBO CAJITA CAPRIKIDS» (S/ 27, tamaño «Cajita»): Frappé Oreo 12 oz + nuggets artesanales
-- + papas nativas mini con salchichas + 2 juguetes a elección. Las partes salen a cocina como líneas hijas.
--
-- Idempotente y aditiva. Todo se busca por nombre exacto (sin distinguir mayúsculas), nunca por id.
-- Si ya existe algo, no se toca. Si falta SALADOS, no se crea nada. Si faltan COMBOS o FRAPPE OREO, no se
-- crea el combo (ni se quita el producto viejo): solo se crean los productos que sí pueden existir.
-- Todo va en un único bloque DO: una sola sentencia, por tanto una sola transacción.

DO $$
DECLARE
  v_salados     BIGINT;
  v_combos      BIGINT;
  v_frappe      BIGINT;
  v_area        BIGINT;
  v_juguetes    BIGINT;
  v_existente   BIGINT;
  v_cajita      BIGINT;
  v_tam_lista   BIGINT;
  v_tam_valor   BIGINT;
  v_oferta      BIGINT;
BEGIN
  SELECT id INTO v_salados FROM categoria WHERE upper(nombre) = 'SALADOS';
  IF v_salados IS NULL THEN
    RAISE NOTICE 'combo_cajita_caprikids: no existe la categoría SALADOS, no se hace nada';
    RETURN;
  END IF;

  -- 1. Salados sueltos: nuggets y papas (visibles, con precio, sin imagen)
  INSERT INTO producto (categoria_id, nombre, precio, orden, oculto, controla_stock, por_lote, no_suma_beneficios, resaltar_opcion_menos_pedida)
  SELECT v_salados, 'NUGGETS ARTESANALES', 8, 0, false, false, false, false, false
  WHERE NOT EXISTS (SELECT 1 FROM producto WHERE lower(nombre) = lower('NUGGETS ARTESANALES'));

  INSERT INTO producto (categoria_id, nombre, precio, orden, oculto, controla_stock, por_lote, no_suma_beneficios, resaltar_opcion_menos_pedida)
  SELECT v_salados, 'PAPAS NATIVAS MINI CON SALCHICHAS', 7, 0, false, false, false, false, false
  WHERE NOT EXISTS (SELECT 1 FROM producto WHERE lower(nombre) = lower('PAPAS NATIVAS MINI CON SALCHICHAS'));

  -- 2. Juguetes: categoría oculta JUGUETES en el área Salados; productos S/ 0 que controlan stock
  SELECT id INTO v_area FROM area_cocina WHERE lower(nombre) = 'salados';
  IF v_area IS NOT NULL THEN
    INSERT INTO categoria (nombre, lleva_opciones, area_id, orden, oculta)
    SELECT 'JUGUETES', false, v_area, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE lower(nombre) = 'juguetes');
  END IF;

  SELECT id INTO v_juguetes FROM categoria WHERE lower(nombre) = 'juguetes';
  IF v_juguetes IS NOT NULL THEN
    INSERT INTO producto (categoria_id, nombre, precio, orden, oculto, controla_stock, por_lote, no_suma_beneficios, resaltar_opcion_menos_pedida)
    SELECT v_juguetes, j.nombre, 0, 0, false, true, false, false, false
    FROM (VALUES ('Pistola de burbujas'), ('Burbujas'), ('Squishy')) AS j(nombre)
    WHERE NOT EXISTS (SELECT 1 FROM producto p WHERE lower(p.nombre) = lower(j.nombre));
  END IF;

  -- 3. Combo: solo si existen COMBOS y FRAPPE OREO (no se inventan)
  SELECT id INTO v_combos FROM categoria WHERE upper(nombre) = 'COMBOS';
  SELECT id INTO v_frappe FROM producto WHERE lower(nombre) = lower('FRAPPE OREO');
  IF v_combos IS NULL OR v_frappe IS NULL OR v_juguetes IS NULL THEN
    RAISE NOTICE 'combo_cajita_caprikids: falta COMBOS, FRAPPE OREO o JUGUETES; el combo no se crea';
    RETURN;
  END IF;

  -- 3a. Producto viejo del mismo nombre (con el grupo «Juguetes (elige 2)»): se quita. Si tiene historial
  -- (líneas de pedido, stock, etc.) no se puede borrar: se oculta y se renombra para no chocar con el nombre único.
  SELECT id INTO v_existente FROM producto WHERE lower(nombre) = lower('COMBO CAJITA CAPRIKIDS');
  IF v_existente IS NOT NULL AND EXISTS (
    SELECT 1 FROM producto_grupo pg JOIN grupo_opciones g ON g.id = pg.grupo_id
    WHERE pg.producto_id = v_existente AND g.nombre = 'Juguetes (elige 2)'
  ) THEN
    -- Con historial no se borra: las FK de pedido_linea y movimiento_stock ponen NULL (no bloquean) y
    -- se perdería el vínculo con las ventas. Sin historial, un RESTRICT (receta, sabor...) también lo oculta.
    IF EXISTS (SELECT 1 FROM pedido_linea WHERE producto_id = v_existente)
       OR EXISTS (SELECT 1 FROM movimiento_stock WHERE producto_id = v_existente) THEN
      UPDATE producto
      SET oculto = true, nombre = 'COMBO CAJITA CAPRIKIDS (ANTERIOR ' || v_existente || ')'
      WHERE id = v_existente;
      RAISE NOTICE 'combo_cajita_caprikids: producto viejo con historial, oculto y renombrado';
    ELSE
      BEGIN
        DELETE FROM producto_grupo WHERE producto_id = v_existente;
        DELETE FROM producto_tamano WHERE producto_id = v_existente;
        DELETE FROM producto WHERE id = v_existente;
        RAISE NOTICE 'combo_cajita_caprikids: producto viejo borrado';
      EXCEPTION WHEN foreign_key_violation THEN
        UPDATE producto
        SET oculto = true, nombre = 'COMBO CAJITA CAPRIKIDS (ANTERIOR ' || v_existente || ')'
        WHERE id = v_existente;
        RAISE NOTICE 'combo_cajita_caprikids: producto viejo bloqueado por una FK, oculto y renombrado';
      END;
    END IF;

    -- El grupo «Juguetes (elige 2)» se quita si ya no lo usa ningún producto
    BEGIN
      DELETE FROM opcion WHERE grupo_id IN (
        SELECT g.id FROM grupo_opciones g
        WHERE g.nombre = 'Juguetes (elige 2)' AND NOT EXISTS (SELECT 1 FROM producto_grupo pg WHERE pg.grupo_id = g.id)
      );
      DELETE FROM grupo_opciones g
      WHERE g.nombre = 'Juguetes (elige 2)' AND NOT EXISTS (SELECT 1 FROM producto_grupo pg WHERE pg.grupo_id = g.id);
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE grupo_opciones SET activo = false
      WHERE nombre = 'Juguetes (elige 2)' AND NOT EXISTS (SELECT 1 FROM producto_grupo pg WHERE pg.grupo_id = grupo_opciones.id);
    END;
  END IF;

  -- 3b. Producto contenedor (COMBOS, tamaño Cajita S/ 27) con su foto
  INSERT INTO producto (categoria_id, nombre, descripcion, precio, orden, oculto, controla_stock, por_lote, no_suma_beneficios, resaltar_opcion_menos_pedida)
  SELECT v_combos, 'COMBO CAJITA CAPRIKIDS',
         'Frappé Oreo 12 oz + nuggets artesanales + papas nativas mini con salchichas ahumadas + 2 juguetes a elección. Para niño o niña. Válido para salón y delivery',
         27, 0, false, false, false, false, false
  WHERE NOT EXISTS (SELECT 1 FROM producto WHERE lower(nombre) = lower('COMBO CAJITA CAPRIKIDS'));

  SELECT id INTO v_cajita FROM producto WHERE lower(nombre) = lower('COMBO CAJITA CAPRIKIDS');

  INSERT INTO archivo (ruta, tipo_mime, bytes, privado)
  VALUES ('publico/seed/caprikids.webp', 'image/webp', 0, false)
  ON CONFLICT (ruta) DO NOTHING;

  UPDATE producto
  SET foto_archivo_id = (SELECT id FROM archivo WHERE ruta = 'publico/seed/caprikids.webp')
  WHERE id = v_cajita AND foto_archivo_id IS NULL;

  -- Tamaño «Cajita» (S/ 27), si existe la lista de tamaños
  SELECT id INTO v_tam_lista FROM lista WHERE codigo = 'TAMANO';
  IF v_tam_lista IS NOT NULL THEN
    INSERT INTO lista_valor (lista_id, nombre, orden, activo)
    SELECT v_tam_lista, 'Cajita', 0, true
    WHERE NOT EXISTS (SELECT 1 FROM lista_valor WHERE lista_id = v_tam_lista AND nombre = 'Cajita');

    SELECT id INTO v_tam_valor FROM lista_valor WHERE lista_id = v_tam_lista AND nombre = 'Cajita';

    INSERT INTO producto_tamano (producto_id, tamano_valor_id, precio, activo, unidades)
    VALUES (v_cajita, v_tam_valor, 27, true, 1)
    ON CONFLICT (producto_id, tamano_valor_id) DO NOTHING;
  END IF;

  -- 3c. Oferta COMBO anfitriona (carta y caja/mozo; sin BOT)
  INSERT INTO oferta (tipo, nombre, descripcion, alcance_producto_id, canales, activo, visible_carta, orden, dias,
                      mostrar_en_saludo_bot, solo_primera_compra, no_suma_beneficios, usos_actuales)
  VALUES ('COMBO', 'COMBO CAJITA CAPRIKIDS',
          'Frappé Oreo 12 oz + nuggets artesanales + papas nativas mini con salchichas ahumadas + 2 juguetes a elección',
          v_cajita, ARRAY['CARTA', 'ADMIN']::TEXT[], true, true, 3, ARRAY[]::INTEGER[],
          false, false, false, 0)
  ON CONFLICT (nombre) DO NOTHING;

  SELECT id INTO v_oferta FROM oferta WHERE nombre = 'COMBO CAJITA CAPRIKIDS';
  -- La oferta de este nombre es la del producto nuevo (el viejo, si quedó oculto o borrado, deja de ser su alcance)
  UPDATE oferta SET alcance_producto_id = v_cajita WHERE id = v_oferta AND alcance_producto_id IS DISTINCT FROM v_cajita;

  IF v_tam_valor IS NOT NULL AND v_oferta IS NOT NULL THEN
    INSERT INTO combo_precio (oferta_id, tamano_valor_id, precio)
    VALUES (v_oferta, v_tam_valor, 27)
    ON CONFLICT (oferta_id, tamano_valor_id) DO NOTHING;
  END IF;

  -- 3d. Partes: FIJO frappé, FIJO nuggets, FIJO papas, A_ELECCION 2 de los juguetes. Solo si la oferta aún no tiene partes.
  IF v_oferta IS NOT NULL AND NOT EXISTS (SELECT 1 FROM combo_parte WHERE oferta_id = v_oferta) THEN
    INSERT INTO combo_parte (oferta_id, tipo, cantidad, categorias, productos)
    VALUES (v_oferta, 'FIJO', 1, ARRAY[]::BIGINT[], ARRAY[v_frappe]::BIGINT[]);

    INSERT INTO combo_parte (oferta_id, tipo, cantidad, categorias, productos)
    SELECT v_oferta, 'FIJO', 1, ARRAY[]::BIGINT[], ARRAY[p.id]::BIGINT[]
    FROM producto p WHERE lower(p.nombre) = lower('NUGGETS ARTESANALES');

    INSERT INTO combo_parte (oferta_id, tipo, cantidad, categorias, productos)
    SELECT v_oferta, 'FIJO', 1, ARRAY[]::BIGINT[], ARRAY[p.id]::BIGINT[]
    FROM producto p WHERE lower(p.nombre) = lower('PAPAS NATIVAS MINI CON SALCHICHAS');

    INSERT INTO combo_parte (oferta_id, tipo, cantidad, categorias, productos)
    SELECT v_oferta, 'A_ELECCION', 2, ARRAY[]::BIGINT[],
           ARRAY(SELECT p.id FROM producto p
                 WHERE p.categoria_id = v_juguetes AND lower(p.nombre) IN ('pistola de burbujas', 'burbujas', 'squishy')
                 ORDER BY p.nombre);
  END IF;

  RAISE NOTICE 'combo_cajita_caprikids: listo';
END $$;
