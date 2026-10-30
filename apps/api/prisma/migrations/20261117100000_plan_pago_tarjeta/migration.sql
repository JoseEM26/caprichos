-- Expand: el plan de pago (pago dividido) admite TARJETA (POS). No lleva voucher.
ALTER TABLE "pedido_pago_plan" DROP CONSTRAINT "ck_pedido_pago_plan_medio";
ALTER TABLE "pedido_pago_plan" ADD CONSTRAINT "ck_pedido_pago_plan_medio" CHECK ("medio" IN ('EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA'));
