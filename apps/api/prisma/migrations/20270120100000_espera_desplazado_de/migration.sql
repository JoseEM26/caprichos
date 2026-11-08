-- Lista de espera: de qué mesa lo desplazaron (marca «Movido desde Mesa N»). Columna nula; idempotente.
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "espera_desplazado_de" TEXT;
