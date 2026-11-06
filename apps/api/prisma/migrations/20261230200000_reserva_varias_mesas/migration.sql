-- Reserva con varias mesas (grupos grandes).
-- La relación ya es muchos a muchos (reserva_mesa: una fila por mesa), así que no hay datos que mover.
-- Esta migración solo impide que una misma mesa quede dos veces en una reserva.
-- Idempotente: borrar duplicados y crear el índice con IF NOT EXISTS se puede repetir sin efecto.

-- Quita filas duplicadas (misma reserva y misma mesa), conservando la de id menor.
DELETE FROM "reserva_mesa" a
USING "reserva_mesa" b
WHERE a."reserva_id" = b."reserva_id"
  AND a."mesa_id" = b."mesa_id"
  AND a."mesa_id" IS NOT NULL
  AND a."id" > b."id";

CREATE UNIQUE INDEX IF NOT EXISTS "reserva_mesa_reserva_id_mesa_id_key"
  ON "reserva_mesa" ("reserva_id", "mesa_id");
