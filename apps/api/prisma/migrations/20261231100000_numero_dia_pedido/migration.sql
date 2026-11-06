-- NUMERO DEL DIA DEL PEDIDO EN COCINA (referencial, aditiva e idempotente)
--
-- 1. pedido.numero_dia / pedido.fecha_dia: correlativo del día (1, 2, 3...) y su día calendario Lima.
--    Se asigna una sola vez, al llegar el pedido a cocina (ver cocina/numero-dia.ts). Anulados conservan el suyo.
--    Pedidos anteriores quedan con NULL («—» en pantalla).
-- 2. contador_diario: una fila por día Lima con el último número entregado. Se incrementa con
--    INSERT ... ON CONFLICT DO UPDATE ... RETURNING dentro de la transacción de llegada a cocina.
-- 3. Índice único (fecha_dia, numero_dia): red de seguridad contra duplicados (NULL no cuenta).
--
-- Sin datos que migrar.

ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "numero_dia" INTEGER;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "fecha_dia" DATE;

CREATE UNIQUE INDEX IF NOT EXISTS "pedido_fecha_dia_numero_dia_key" ON "pedido" ("fecha_dia", "numero_dia");

CREATE TABLE IF NOT EXISTS "contador_diario" (
    "fecha" DATE NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "contador_diario_pkey" PRIMARY KEY ("fecha")
);
