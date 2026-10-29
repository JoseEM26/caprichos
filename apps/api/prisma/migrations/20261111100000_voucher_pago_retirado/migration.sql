-- Voucher retirado (quitado): no borra nada. reemplazado_en queda marcado para que no cuente como vigente.
ALTER TABLE "voucher_pago" ADD COLUMN "retirado" BOOLEAN NOT NULL DEFAULT false;
