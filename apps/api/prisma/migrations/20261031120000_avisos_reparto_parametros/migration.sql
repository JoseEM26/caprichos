-- Avisos de WhatsApp al cliente en cada etapa del delivery (salida, llegada, espera, retiro, aceptado, listo, entregado)
-- y parámetros de tiempos de puerta. Idempotente: no pisa valores que el local ya haya cambiado.

INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_salida_activo', '"si"'::jsonb),
  ('whatsapp_aviso_llegada_activo', '"si"'::jsonb),
  ('whatsapp_aviso_espera_activo', '"si"'::jsonb),
  ('whatsapp_aviso_recojo_activo', '"si"'::jsonb),
  ('whatsapp_aviso_pago_confirmado_activo', '"si"'::jsonb),
  ('whatsapp_aviso_listo_activo', '"si"'::jsonb),
  ('whatsapp_aviso_entregado_activo', '"si"'::jsonb),
  ('whatsapp_aviso_encuesta_activo', '"si"'::jsonb),
  ('reparto_insistencia_min', '3'::jsonb),
  ('reparto_espera_max_min', '10'::jsonb),
  ('reparto_recargo_reprogramacion', '0'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
