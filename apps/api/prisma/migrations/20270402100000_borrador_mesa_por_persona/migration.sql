-- Borrador de pedido de mesa: uno por mesa y por persona (antes uno por mesa, compartido)
DROP INDEX "pedido_borrador_mesa_mesa_id_key";
CREATE UNIQUE INDEX "pedido_borrador_mesa_mesa_id_party_id_key" ON "pedido_borrador_mesa"("mesa_id", "party_id");
