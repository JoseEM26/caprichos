-- Pruebas de impresión (botones «Imprimir etiqueta/ticket de prueba»): trabajo sin pedido real.
-- Solo quita la obligatoriedad de pedido_id; no borra nada. Idempotente.
ALTER TABLE "print_job" ALTER COLUMN "pedido_id" DROP NOT NULL;
