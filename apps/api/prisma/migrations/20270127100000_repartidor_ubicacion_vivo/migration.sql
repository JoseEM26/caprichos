-- Última posición del repartidor en ruta (solo el local la ve): una fila por repartidor, sin historial.
CREATE TABLE IF NOT EXISTS "ubicacion_repartidor" (
    "repartidor_party_id" BIGINT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION,
    "rumbo" DOUBLE PRECISION,
    "velocidad" DOUBLE PRECISION,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ubicacion_repartidor_pkey" PRIMARY KEY ("repartidor_party_id")
);
