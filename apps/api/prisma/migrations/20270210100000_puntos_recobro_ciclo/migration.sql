-- Re-cobro suma de nuevo: un pedido puede tener un SUMA por cada cobro vigente (ciclo). Aditiva e idempotente:
-- las filas existentes quedan en ciclo 1 (valor por defecto constante, sin reescribir datos).
ALTER TABLE "movimiento_puntos" ADD COLUMN IF NOT EXISTS "ciclo" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS "movimiento_puntos_pedido_id_tipo_ciclo_key" ON "movimiento_puntos"("pedido_id", "tipo", "ciclo");
DROP INDEX IF EXISTS "movimiento_puntos_pedido_id_tipo_key";
