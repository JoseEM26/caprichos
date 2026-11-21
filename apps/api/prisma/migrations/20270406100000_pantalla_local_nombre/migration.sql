-- Pantalla de TV del local: mostrar el nombre de pila del cliente (por defecto sí)
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('pantalla_local_mostrar_nombre', '"si"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
