-- WhatsApp en todos los pedidos (decisión del dueño, 13/11/2026): pedido recibido, pago confirmado, entregado y
-- encuesta salen para cualquier canal (carta, Caja, mozo, bot, delivery o no) con celular válido. Este interruptor
-- general gobierna lo ampliado (lo que ya salía para la carta y el delivery no depende de él). Encendido por defecto.
-- Los interruptores whatsapp_aviso_recibido / pago_confirmado / entregado / encuesta existentes no se tocan.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_todos_pedidos_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
