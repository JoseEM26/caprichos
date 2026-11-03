-- Avisos de WhatsApp por pedido de la carta: se bajan los mensajes (decisión del dueño, 02/11/2026).
-- Quedan: RECIBIDO (con enlace de seguimiento), LISTO y LLEGADA. Se apagan: ACEPTADO, SALIDA, ENTREGADO,
-- ENCUESTA y el recordatorio de pago a los 10 min. El código no se borra: basta con volver a «Sí».
-- El UPDATE solo toca los que siguen en «Sí» (el valor por defecto de hoy).

UPDATE "parametro"
SET "valor" = '"no"'::jsonb
WHERE "clave" IN (
  'whatsapp_aviso_pago_confirmado_activo',
  'whatsapp_aviso_salida_activo',
  'whatsapp_aviso_entregado_activo',
  'whatsapp_aviso_encuesta_activo',
  'chatbot_pago_recordatorio_activo'
)
AND "valor" = '"si"'::jsonb;

-- Flags nuevos, apagados: el recordatorio de voucher (antes compartía flag con RECIBIDO) y la plantilla
-- de RECIBIDO con enlace (solo se usa cuando Meta la aprueba). Precio por mensaje y tope gratis (defecto 0.10 PEN y 1000).
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_voucher_recordatorio_activo', '"no"'::jsonb),
  ('whatsapp_plantilla_recibido_seguimiento_activa', '"no"'::jsonb),
  ('wa_precio_mensaje', '0.10'::jsonb),
  ('wa_gratis_mes', '1000'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
