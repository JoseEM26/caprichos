-- Agregar canal WHATSAPP al check constraint ck_pedido_canal en tabla pedido
ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_canal;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_canal CHECK (canal IN ('CARTA','BOT','TELEFONO','MOSTRADOR','MOZO','CAJA','WHATSAPP'));
