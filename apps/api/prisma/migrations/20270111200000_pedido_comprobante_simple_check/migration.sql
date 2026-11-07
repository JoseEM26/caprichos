-- El comprobante simple (ticket interno sin SUNAT) es un valor valido de pedido.comprobante_tipo.
-- La restriccion original solo admitia NOTA_VENTA, BOLETA y FACTURA: crear o cobrar un pedido con SIMPLE fallaba en la base
-- (error al procesar la solicitud en la carta y «te paso con una persona» en el bot). Idempotente.
ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_comprobante_tipo;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_comprobante_tipo CHECK (comprobante_tipo IN ('SIMPLE','NOTA_VENTA','BOLETA','FACTURA'));
