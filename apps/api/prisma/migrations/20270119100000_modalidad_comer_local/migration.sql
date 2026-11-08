-- «Comer en el local»: el cliente que ya está en el local pide desde la carta sin mesa; se le llama por su nombre.
-- Amplía el CHECK de modalidad con COMER_LOCAL. Idempotente: no toca datos y se puede reaplicar.
ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_modalidad;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_modalidad CHECK (modalidad IN ('DELIVERY','RECOGER','MESA','LLEVAR','COMER_LOCAL'));
