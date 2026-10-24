-- RNF-CAP-014: un cobro anulado se conserva (quién, cuándo y por qué). Antes el índice único sobre pedido_id
-- obligaba a borrar el cobro anulado al volver a cobrar el pedido. Ahora un pedido puede tener varios cobros,
-- pero solo uno vigente (anulado_en IS NULL).
DROP INDEX "cobro_pedido_id_key";

CREATE UNIQUE INDEX "cobro_pedido_vigente_key" ON "cobro"("pedido_id") WHERE "anulado_en" IS NULL;
