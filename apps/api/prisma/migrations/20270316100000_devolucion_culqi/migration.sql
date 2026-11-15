-- Devolución por Culqi desde la anulación: un solo registro por pedido (devolucion_pedido) con su estado.
-- Idempotente. El trigger de inmutabilidad se relaja solo para filas CULQI (su estado cambia al reintentar)
-- y para completar la baja del comprobante; borrar sigue prohibido.

ALTER TABLE "devolucion_pedido" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'HECHA';
ALTER TABLE "devolucion_pedido" ADD COLUMN IF NOT EXISTS "culqi_intento_id" BIGINT;
ALTER TABLE "devolucion_pedido" ADD COLUMN IF NOT EXISTS "culqi_devolucion_id" TEXT;
ALTER TABLE "devolucion_pedido" ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE "devolucion_pedido" DROP CONSTRAINT IF EXISTS "ck_devolucion_pedido_medio";
ALTER TABLE "devolucion_pedido" ADD CONSTRAINT "ck_devolucion_pedido_medio"
  CHECK ("medio" IN ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'CULQI'));

ALTER TABLE "devolucion_pedido" DROP CONSTRAINT IF EXISTS "ck_devolucion_pedido_codigo";
ALTER TABLE "devolucion_pedido" ADD CONSTRAINT "ck_devolucion_pedido_codigo"
  CHECK ("medio" IN ('EFECTIVO', 'CULQI') OR char_length(btrim("codigo_operacion")) > 0);

ALTER TABLE "devolucion_pedido" DROP CONSTRAINT IF EXISTS "ck_devolucion_pedido_estado";
ALTER TABLE "devolucion_pedido" ADD CONSTRAINT "ck_devolucion_pedido_estado"
  CHECK ("estado" IN ('HECHA', 'PENDIENTE', 'PENDIENTE_APROBACION', 'FALLIDA'));

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
