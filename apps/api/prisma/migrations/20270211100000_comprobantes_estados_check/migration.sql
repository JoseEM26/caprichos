-- Amplía dos CHECK que el código ya usaba sin que la base los admitiera (el UPDATE fallaba con 23514):
--  * facturacion_estado: REVISION_MANUAL (cola de fallos tras agotar intentos o rechazo permanente).
--  * baja_estado: PENDIENTE_BAJA (SUNAT no recibió la comunicación de baja; el barrido la repite).
-- Aditiva e idempotente: solo suelta y vuelve a crear la restricción con más valores.
ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_facturacion_estado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_facturacion_estado"
  CHECK ("facturacion_estado" IS NULL OR "facturacion_estado" IN ('EMITIDO_SUNAT', 'RECHAZADO', 'PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'ENVIADA_RESUMEN', 'REVISION_MANUAL'));

ALTER TABLE "comprobante" DROP CONSTRAINT IF EXISTS "ck_comprobante_baja_estado";
ALTER TABLE "comprobante" ADD CONSTRAINT "ck_comprobante_baja_estado"
  CHECK ("baja_estado" IS NULL OR "baja_estado" IN ('SOLICITADA', 'ACEPTADA', 'RECHAZADA', 'PENDIENTE_RESUMEN', 'PENDIENTE_BAJA'));
