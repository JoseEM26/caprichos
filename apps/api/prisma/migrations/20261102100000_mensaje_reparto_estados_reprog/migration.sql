-- La reprogramación guarda en mensaje_reparto.estado los estados REPROGRAMAR, REPROGRAMADO,
-- NO_REPROGRAMAR, SIN_RESPUESTA y TOPE_ALCANZADO; el CHECK original solo admitía 4 y los rechazaba.
-- Amplía la lista (expand: no invalida filas existentes). Idempotente.
ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_estado";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_estado" CHECK ("estado" IN (
  'PENDIENTE', 'ENVIADO', 'RESPONDIDO', 'FALLIDO',
  'REPROGRAMAR', 'REPROGRAMADO', 'NO_REPROGRAMAR', 'SIN_RESPUESTA', 'TOPE_ALCANZADO'
));
