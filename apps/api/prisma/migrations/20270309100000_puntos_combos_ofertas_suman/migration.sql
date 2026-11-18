-- Puntos de combos y ofertas: dos interruptores de operación, apagados por defecto (el comportamiento no cambia).
-- Encendidos, la línea de combo (puntos_combos_suman) o de oferta (puntos_ofertas_suman) suma puntos sobre lo cobrado.
-- No toca pedidos pasados ni lo ya sumado. No pisa un valor ya puesto.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('puntos_combos_suman', '"no"'::jsonb),
  ('puntos_ofertas_suman', '"no"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
