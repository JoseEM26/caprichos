-- Interruptor de las plantillas de delivery con ubicación (apagado hasta que Meta las apruebe). Aditiva e idempotente.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_plantilla_delivery_ubicacion_activa', '"no"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
