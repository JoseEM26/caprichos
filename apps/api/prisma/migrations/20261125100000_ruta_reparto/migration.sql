-- Reparto: la ruta como unidad (una salida del repartidor con sus pedidos). Operativa: no migra a produccion.
CREATE TABLE IF NOT EXISTS "ruta_reparto" (
  "id" BIGSERIAL PRIMARY KEY,
  "repartidor_party_id" BIGINT NOT NULL,
  "iniciada_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "terminada_en" TIMESTAMPTZ,
  "estado" TEXT NOT NULL DEFAULT 'EN_CURSO',
  "origen" TEXT NOT NULL,
  "creada_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ruta_reparto_repartidor_party_id_fkey" FOREIGN KEY ("repartidor_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ruta_reparto_repartidor_estado_idx" ON "ruta_reparto"("repartidor_party_id", "estado");

ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ruta_reparto_id" BIGINT;
CREATE INDEX IF NOT EXISTS "pedido_ruta_reparto_id_idx" ON "pedido"("ruta_reparto_id");
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_ruta_reparto_id_fkey" FOREIGN KEY ("ruta_reparto_id") REFERENCES "ruta_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
