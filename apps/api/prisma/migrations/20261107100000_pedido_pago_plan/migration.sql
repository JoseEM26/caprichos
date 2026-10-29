-- Pago dividido (aditivo): plan de pago declarado al hacer el pedido, un renglon por medio.
-- Solo la parte digital (YAPE, PLIN, TRANSFERENCIA) lleva voucher; EFECTIVO no.
-- CreateTable
CREATE TABLE "pedido_pago_plan" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "medio" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_pago_plan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_pedido_pago_plan_medio" CHECK ("medio" IN ('EFECTIVO','YAPE','PLIN','TRANSFERENCIA')),
    CONSTRAINT "ck_pedido_pago_plan_monto" CHECK ("monto" > 0)
);

-- CreateIndex
CREATE INDEX "pedido_pago_plan_pedido_id_idx" ON "pedido_pago_plan"("pedido_id");

-- AddForeignKey
ALTER TABLE "pedido_pago_plan" ADD CONSTRAINT "pedido_pago_plan_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
