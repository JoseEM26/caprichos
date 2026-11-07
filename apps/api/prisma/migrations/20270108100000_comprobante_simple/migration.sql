-- Comprobante simple: ticket interno sin SUNAT, ahora es el valor por defecto del pedido.
-- Los pedidos existentes conservan su boleta/factura. Idempotente (SET DEFAULT se puede repetir).
ALTER TABLE "pedido" ALTER COLUMN "comprobante_tipo" SET DEFAULT 'SIMPLE';
