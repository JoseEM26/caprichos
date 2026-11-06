-- CAMBIO DE UBICACIÓN DE DELIVERY (aditiva e idempotente)
--
-- 1. pedido.ubicacion_editada_en: marca «Dirección editada» (se pone al aplicar un cambio, sea de Caja o aprobado).
-- 2. pedido_cambio_ubicacion: historial de cambios de punto. Una fila por propuesta o cambio directo de Caja.
--    - origen CAJA (Caja cambió el punto) | REPARTIDOR (el repartidor propuso y Caja decidió).
--    - estado PROPUESTA | APROBADA | RECHAZADA | CANCELADA. Solo una PROPUESTA por pedido (índice parcial).
--    - ajuste_*: diferencia de cobro cuando el pedido ya estaba pagado.
--        SALDO (envío nuevo mayor): queda por cobrar; al cobrarlo ajuste_estado = COBRADO.
--        DEVOLUCION (envío nuevo menor): queda por devolver; al devolverlo ajuste_estado = DEVUELTO.
--      Solo cuando COBRADO/DEVUELTO entra al cierre (efectivo como movimiento de caja; digital en el neto).
--    - aviso_cliente: qué pasó con el aviso por WhatsApp (solo si cambia el envío).
--
-- Idempotente: IF NOT EXISTS en todo. Sin datos que migrar.

ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ubicacion_editada_en" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "pedido_cambio_ubicacion" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "origen" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "propuesto_por_party_id" BIGINT NOT NULL,
    "propuesto_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resuelto_por_party_id" BIGINT,
    "resuelto_en" TIMESTAMPTZ,
    "nota" TEXT,
    "motivo" TEXT,
    "lat_anterior" DECIMAL(9,6),
    "lng_anterior" DECIMAL(9,6),
    "direccion_anterior" TEXT,
    "referencia_anterior" TEXT,
    "zona_anterior_id" BIGINT,
    "lat_nueva" DECIMAL(9,6) NOT NULL,
    "lng_nueva" DECIMAL(9,6) NOT NULL,
    "direccion_nueva" TEXT,
    "referencia_nueva" TEXT,
    "zona_nueva_id" BIGINT,
    "envio_anterior" DECIMAL(12,2) NOT NULL,
    "envio_nuevo" DECIMAL(12,2),
    "total_anterior" DECIMAL(12,2) NOT NULL,
    "total_nuevo" DECIMAL(12,2),
    "diferencia_envio" DECIMAL(12,2),
    "ajuste_tipo" TEXT,
    "ajuste_monto" DECIMAL(12,2),
    "ajuste_estado" TEXT,
    "ajuste_medio" TEXT,
    "ajuste_codigo_operacion" TEXT,
    "ajuste_por_party_id" BIGINT,
    "ajuste_en" TIMESTAMPTZ,
    "ajuste_movimiento_caja_id" BIGINT,
    "aviso_cliente" TEXT,
    CONSTRAINT "pedido_cambio_ubicacion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pedido_cambio_ubicacion_origen_check" CHECK ("origen" IN ('CAJA', 'REPARTIDOR')),
    CONSTRAINT "pedido_cambio_ubicacion_estado_check" CHECK ("estado" IN ('PROPUESTA', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
    CONSTRAINT "pedido_cambio_ubicacion_ajuste_tipo_check" CHECK ("ajuste_tipo" IS NULL OR "ajuste_tipo" IN ('SALDO', 'DEVOLUCION')),
    CONSTRAINT "pedido_cambio_ubicacion_ajuste_estado_check" CHECK ("ajuste_estado" IS NULL OR "ajuste_estado" IN ('PENDIENTE', 'COBRADO', 'DEVUELTO')),
    CONSTRAINT "pedido_cambio_ubicacion_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_zona_anterior_id_fkey" FOREIGN KEY ("zona_anterior_id") REFERENCES "zona_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_zona_nueva_id_fkey" FOREIGN KEY ("zona_nueva_id") REFERENCES "zona_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_propuesto_por_party_id_fkey" FOREIGN KEY ("propuesto_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_resuelto_por_party_id_fkey" FOREIGN KEY ("resuelto_por_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_ajuste_por_party_id_fkey" FOREIGN KEY ("ajuste_por_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedido_cambio_ubicacion_ajuste_movimiento_caja_id_fkey" FOREIGN KEY ("ajuste_movimiento_caja_id") REFERENCES "movimiento_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pedido_cambio_ubicacion_pedido_id_idx" ON "pedido_cambio_ubicacion" ("pedido_id");
CREATE INDEX IF NOT EXISTS "pedido_cambio_ubicacion_ajuste_en_idx" ON "pedido_cambio_ubicacion" ("ajuste_en");
-- Una sola propuesta pendiente por pedido (la BD lo garantiza aunque dos pestañas envíen a la vez)
CREATE UNIQUE INDEX IF NOT EXISTS "pedido_cambio_ubicacion_propuesta_unica" ON "pedido_cambio_ubicacion" ("pedido_id") WHERE "estado" = 'PROPUESTA';
