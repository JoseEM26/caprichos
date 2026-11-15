-- Decisiones del dueno (15/11) sobre WhatsApp y Evolution.
-- 1) La encuesta posventa sale a los 15 minutos de entregado el pedido (antes 30).
-- 2) Topes de Evolution: 350 por dia y 60 por hora. Se mantiene 3 por minuto: con 60 por hora el tope de la hora
--    manda (1 por minuto en promedio) y 3 por minuto deja pasar un pico corto sin estrangularlo.
-- 3) Pausa automatica: 5 fallos de envio seguidos en 10 minutos pasan el proveedor a Meta.
-- 4) Los avisos de Evolution salen igual que con Meta: la lista blanca de origenes queda vacia (vacio = todos los de Meta).
--    Los horarios evolution_horario_desde/hasta quedan solo como respaldo si no se puede leer el horario del local.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('encuesta_espera_min', '15'::jsonb),
  ('evolution_limite_dia', '350'::jsonb),
  ('evolution_limite_hora', '60'::jsonb),
  ('evolution_fallos_seguidos', '5'::jsonb),
  ('evolution_fallos_ventana_min', '10'::jsonb),
  ('evolution_origenes_permitidos', '""'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
