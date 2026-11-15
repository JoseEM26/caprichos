-- La anulación de un pedido pagado completa comprobante_baja_estado en su devolución después de anular el cobro,
-- pero el trigger de inmutabilidad prohibía todo UPDATE: esa anulación terminaba en error con la devolución ya
-- registrada. Se permite solo ese campo; editar cualquier otro dato o borrar sigue prohibido.
CREATE OR REPLACE FUNCTION devolucion_pedido_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'comprobante_baja_estado') = (to_jsonb(OLD) - 'comprobante_baja_estado') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las devoluciones no se editan ni se borran';
END;
$$;
