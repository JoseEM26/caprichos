-- Cupón «Lo da el mozo o cajero» (ASIGNADO_PERSONAL): nuevo modo, quién lo otorgó y quién/por qué canal lo canjeó
ALTER TABLE "cupon" DROP CONSTRAINT "ck_cupon_modo";
ALTER TABLE "cupon"
  ADD CONSTRAINT "ck_cupon_modo" CHECK ("modo" IN ('UNICO_COMPROBANTE', 'COMPARTIDO', 'ASIGNADO_PERSONAL'));

ALTER TABLE "cupon_emitido" ADD COLUMN "otorgado_por" BIGINT;
ALTER TABLE "cupon_emitido" ADD COLUMN "canjeado_por" BIGINT;
ALTER TABLE "cupon_emitido" ADD COLUMN "canjeado_canal" TEXT;
