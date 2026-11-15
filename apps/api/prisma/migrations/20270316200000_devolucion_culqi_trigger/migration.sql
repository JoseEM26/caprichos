-- En pre-producción la migración de la baja del comprobante (main) se aplicó después de la de Culqi y dejó el trigger sin
-- la excepción de las filas CULQI. Se vuelve a definir igual que en 20270316100000_devolucion_culqi (idempotente).
CREATE OR REPLACE FUNCTION devolucion_pedido_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD."medio" = 'CULQI'
    OR (to_jsonb(NEW) - 'comprobante_baja_estado') = (to_jsonb(OLD) - 'comprobante_baja_estado')
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Las devoluciones no se editan ni se borran';
END;
$$;
