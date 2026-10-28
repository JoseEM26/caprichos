-- El recordatorio de voucher usa la etapa 14 de mensaje_reparto: el CHECK de numero admitía solo 1 a 13
-- y rechazaba la fila (23514). Se amplía de forma aditiva; el resto de etapas no cambia.
ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_numero";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 14);
