-- Borrador de pedido de mesa (uno por mesa; no ocupa la mesa)
CREATE TABLE "pedido_borrador_mesa" (
  "id" BIGSERIAL PRIMARY KEY,
  "mesa_id" BIGINT NOT NULL,
  "party_id" BIGINT NOT NULL,
  "contenido" JSONB NOT NULL,
  "productos" INTEGER NOT NULL DEFAULT 0,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "pedido_borrador_mesa_mesa_id_key" ON "pedido_borrador_mesa"("mesa_id");
ALTER TABLE "pedido_borrador_mesa" ADD CONSTRAINT "pedido_borrador_mesa_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "elemento_plano"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_borrador_mesa" ADD CONSTRAINT "pedido_borrador_mesa_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
