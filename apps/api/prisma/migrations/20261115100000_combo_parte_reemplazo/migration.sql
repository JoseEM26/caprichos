-- Expand: reemplazos (plan B, plan C...) del producto fijo de una parte de combo. Tabla nueva, sin tocar datos existentes.
CREATE TABLE "combo_parte_reemplazo" (
    "id" BIGSERIAL NOT NULL,
    "combo_parte_id" BIGINT NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "combo_parte_reemplazo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "combo_parte_reemplazo_combo_parte_id_producto_id_key" ON "combo_parte_reemplazo"("combo_parte_id", "producto_id");
CREATE INDEX "combo_parte_reemplazo_combo_parte_id_orden_idx" ON "combo_parte_reemplazo"("combo_parte_id", "orden");

ALTER TABLE "combo_parte_reemplazo" ADD CONSTRAINT "combo_parte_reemplazo_combo_parte_id_fkey" FOREIGN KEY ("combo_parte_id") REFERENCES "combo_parte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "combo_parte_reemplazo" ADD CONSTRAINT "combo_parte_reemplazo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
