-- WhatsApp en todos los pedidos (decisión del dueño, 13/11/2026): pedido recibido, pago confirmado, entregado y
-- encuesta salen para cualquier canal (carta, Caja, mozo, bot, delivery o no) con celular válido. Este interruptor
-- general gobierna lo ampliado (lo que ya salía para la carta y el delivery no depende de él). Encendido por defecto.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_todos_pedidos_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- Decisión del dueño (13/11/2026): los 4 avisos quedan encendidos. La migración 20261209100000 había apagado
-- pago_confirmado, entregado y encuesta; entregado y encuesta se reencendieron después (20270104, 20270218) y
-- pago_confirmado nunca. Se fuerzan los 4 en «Sí»; se pueden apagar desde Parámetros › Avisos.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_recibido_activo', '"si"'::jsonb),
  ('whatsapp_aviso_pago_confirmado_activo', '"si"'::jsonb),
  ('whatsapp_aviso_entregado_activo', '"si"'::jsonb),
  ('whatsapp_aviso_encuesta_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = '"si"'::jsonb;
