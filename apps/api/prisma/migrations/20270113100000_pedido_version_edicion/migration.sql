-- «Editar pedido»: versión para el control optimista (aditiva e idempotente)
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
