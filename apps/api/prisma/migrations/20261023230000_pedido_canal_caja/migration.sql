-- El canal CAJA (pedidos abiertos desde Pedidos y caja) no estaba permitido y el pedido fallaba con error 500
ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS ck_pedido_canal;
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_canal CHECK (canal IN ('CARTA','BOT','TELEFONO','MOSTRADOR','MOZO','CAJA'));
