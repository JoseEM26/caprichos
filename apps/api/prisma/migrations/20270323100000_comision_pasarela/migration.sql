-- Comisión de la pasarela (Culqi) por cobro: la asume el local, el cliente no la ve.
ALTER TABLE "cobro_pago" ADD COLUMN "comision_pasarela" DECIMAL(10,2);
ALTER TABLE "cobro_pago" ADD COLUMN "comision_detalle" JSONB;
