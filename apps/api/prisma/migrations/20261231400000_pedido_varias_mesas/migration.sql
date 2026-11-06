-- PEDIDO CON VARIAS MESAS (aditiva e idempotente)
--
-- pedido_mesa ya es muchos a muchos (una fila por mesa y pedido). Esta migración agrega:
--   orden      posición de la mesa dentro del pedido (1 = principal)
--   principal  la mesa que da el nombre al pedido (pedido.mesa_nombre) y la que va primero
-- y deja un índice único para que una mesa abierta no quede dos veces en el mismo pedido.
-- Pedido.mesa_nombre no cambia de columna: sigue siendo el nombre visible del pedido.

-- 1. Columnas nuevas (los pedidos existentes quedan con orden 1 y principal a asignar abajo)
ALTER TABLE "pedido_mesa" ADD COLUMN IF NOT EXISTS "orden" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "pedido_mesa" ADD COLUMN IF NOT EXISTS "principal" BOOLEAN NOT NULL DEFAULT false;

-- 2. Quita filas abiertas repetidas (misma mesa en el mismo pedido), conservando la de id menor
DELETE FROM "pedido_mesa" a
USING "pedido_mesa" b
WHERE a."pedido_id" = b."pedido_id"
  AND a."mesa_id" = b."mesa_id"
  AND a."abierta"
  AND b."abierta"
  AND a."id" > b."id";

-- 3. Mesa principal: por cada pedido sin principal, la fila abierta más antigua (o la más antigua si ya está cerrado)
UPDATE "pedido_mesa" pm
SET "principal" = true
WHERE pm."id" = (
    SELECT x."id" FROM "pedido_mesa" x
    WHERE x."pedido_id" = pm."pedido_id"
    ORDER BY x."abierta" DESC, x."id" ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "pedido_mesa" y WHERE y."pedido_id" = pm."pedido_id" AND y."principal"
  );

-- 4. Orden dentro de cada pedido: la principal primero, luego por id (determinista, repetible)
UPDATE "pedido_mesa" pm
SET "orden" = r."rn"
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "pedido_id" ORDER BY "principal" DESC, "id" ASC) AS "rn"
  FROM "pedido_mesa"
) r
WHERE pm."id" = r."id" AND pm."orden" <> r."rn";

-- 5. Una mesa abierta una sola vez por pedido, y una sola principal abierta por pedido
CREATE UNIQUE INDEX IF NOT EXISTS "ux_pedido_mesa_pedido_mesa_abierta"
  ON "pedido_mesa" ("pedido_id", "mesa_id") WHERE "abierta";

CREATE UNIQUE INDEX IF NOT EXISTS "ux_pedido_mesa_principal_abierta"
  ON "pedido_mesa" ("pedido_id") WHERE "principal" AND "abierta";
