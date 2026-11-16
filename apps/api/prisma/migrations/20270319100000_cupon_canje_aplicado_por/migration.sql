-- Quién aplicó el cupón compartido y por qué canal (los canjes viejos quedan en NULL)
ALTER TABLE "cupon_canje_compartido" ADD COLUMN "aplicado_por" BIGINT;
ALTER TABLE "cupon_canje_compartido" ADD COLUMN "canal" TEXT;
