-- Huecos del cierre: justificado de entregados sin cobrar y liquidación del reparto por pedido
ALTER TABLE "pedido" ADD COLUMN "sin_cobro_justificado_en" TIMESTAMPTZ;
ALTER TABLE "pedido" ADD COLUMN "liquidado_en" TIMESTAMPTZ;

-- Lo entregado antes de hoy (Lima) se da por liquidado: no se reclama de golpe al abrir la próxima caja
UPDATE "pedido" SET "liquidado_en" = "entregado_en"
WHERE "modalidad" = 'DELIVERY' AND "estado" = 'ENTREGADO' AND "entregado_en" IS NOT NULL
  AND "entregado_en" < (date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima');
-- Lo de hoy ya liquidado: tiene liquidación del mismo repartidor posterior a su entrega
UPDATE "pedido" p SET "liquidado_en" = l."en"
FROM "liquidacion" l
WHERE p."liquidado_en" IS NULL AND p."modalidad" = 'DELIVERY' AND p."estado" = 'ENTREGADO'
  AND l."repartidor_party_id" = p."repartidor_party_id" AND l."en" >= p."entregado_en";

-- Movimiento INFORMATIVO: deja rastro en el cierre de hoy (p. ej. cobro digital anulado de una caja cerrada) sin tocar el efectivo esperado
ALTER TABLE "movimiento_caja" DROP CONSTRAINT "ck_movimiento_caja_tipo";
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "ck_movimiento_caja_tipo" CHECK ("tipo" IN ('INGRESO', 'EGRESO', 'INFORMATIVO'));
