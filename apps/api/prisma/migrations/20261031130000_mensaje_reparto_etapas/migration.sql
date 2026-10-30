-- Las etapas de aviso del reparto pasan de 1-3 a 1-8 (espera, retiro, aceptado, listo, entregado).
ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_numero";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 8);
