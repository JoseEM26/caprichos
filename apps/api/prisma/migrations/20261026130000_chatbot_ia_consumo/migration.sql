-- CreateTable
CREATE TABLE "ia_consumo" (
    "id" BIGSERIAL NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversacion_id" BIGINT,
    "modelo" VARCHAR(100) NOT NULL,
    "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
    "tokens_salida" INTEGER NOT NULL DEFAULT 0,
    "costo_usd_estimado" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "herramientas_usadas" JSONB,
    "resultado" VARCHAR(50) NOT NULL,

    CONSTRAINT "ia_consumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ia_consumo_fecha_idx" ON "ia_consumo"("fecha");

-- CreateIndex
CREATE INDEX "ia_consumo_conversacion_id_idx" ON "ia_consumo"("conversacion_id");

-- AddForeignKey
ALTER TABLE "ia_consumo" ADD CONSTRAINT "ia_consumo_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
