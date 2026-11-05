-- Devolución de un pedido cancelado por no recibir que ya estaba pagado.
-- Idempotente: se puede volver a ejecutar sin efecto. Solo se inserta: el trigger impide UPDATE y DELETE.

CREATE TABLE IF NOT EXISTS "devolucion_pedido" (
  "id"                      BIGSERIAL PRIMARY KEY,
  "pedido_id"               BIGINT        NOT NULL,
  "monto_pagado"            DECIMAL(12,2) NOT NULL,
  "monto_envio"             DECIMAL(12,2) NOT NULL,
  "monto_sugerido"          DECIMAL(12,2) NOT NULL,
  "monto_devuelto"          DECIMAL(12,2) NOT NULL,
  "medio"                   TEXT          NOT NULL,
  "codigo_operacion"        TEXT,
  "motivo"                  TEXT,
  "por_party_id"            BIGINT        NOT NULL,
  "autorizado_por_party_id" BIGINT        NOT NULL,
  "comprobante_baja_estado" TEXT,
  "movimiento_caja_id"      BIGINT,
  "creado_en"               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "devolucion_pedido_pedido_id_key" ON "devolucion_pedido" ("pedido_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_pedido_pedido_id_fkey') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "devolucion_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_pedido_por_party_id_fkey') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "devolucion_pedido_por_party_id_fkey" FOREIGN KEY ("por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_pedido_autorizado_por_party_id_fkey') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "devolucion_pedido_autorizado_por_party_id_fkey" FOREIGN KEY ("autorizado_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_pedido_movimiento_caja_id_fkey') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "devolucion_pedido_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "movimiento_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_devolucion_pedido_montos') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "ck_devolucion_pedido_montos" CHECK (
        "monto_pagado" >= 0 AND "monto_envio" >= 0 AND "monto_sugerido" >= 0
        AND "monto_devuelto" > 0 AND "monto_devuelto" <= "monto_pagado"
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_devolucion_pedido_medio') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "ck_devolucion_pedido_medio" CHECK ("medio" IN ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_devolucion_pedido_codigo') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "ck_devolucion_pedido_codigo" CHECK (
        "medio" = 'EFECTIVO' OR char_length(btrim("codigo_operacion")) > 0
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_devolucion_pedido_motivo') THEN
    ALTER TABLE "devolucion_pedido"
      ADD CONSTRAINT "ck_devolucion_pedido_motivo" CHECK (
        "monto_devuelto" = "monto_sugerido" OR char_length(btrim("motivo")) >= 10
      );
  END IF;
END $$;

-- Historial append-only: ni se edita ni se borra (mismo patrón que cierre_ajuste_medio)
CREATE OR REPLACE FUNCTION devolucion_pedido_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las devoluciones no se editan ni se borran';
END;
$$;

DROP TRIGGER IF EXISTS tg_devolucion_pedido_inmutable ON "devolucion_pedido";
CREATE TRIGGER tg_devolucion_pedido_inmutable
  BEFORE UPDATE OR DELETE ON "devolucion_pedido"
  FOR EACH ROW EXECUTE FUNCTION devolucion_pedido_inmutable();
