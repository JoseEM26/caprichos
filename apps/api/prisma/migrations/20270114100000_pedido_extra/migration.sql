-- «Pedido extra»: pedido enlazado al original (aditiva e idempotente; los pedidos existentes quedan en NULL)
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "pedido_origen_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_pedido_origen_id_fkey') THEN
    ALTER TABLE "pedido"
      ADD CONSTRAINT "pedido_pedido_origen_id_fkey"
      FOREIGN KEY ("pedido_origen_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pedido_pedido_origen_id_idx" ON "pedido"("pedido_origen_id");
