-- Recordatorio de voucher a los pedidos de carta con pago digital (aditivo, idempotente).
-- voucher_recordatorio_min: minutos desde el aviso de pedido recibido antes de pedir el voucher otra vez.
-- ON CONFLICT DO NOTHING: no pisa lo que el dueño ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_recordatorio_min', '3'::jsonb) ON CONFLICT ("clave") DO NOTHING;
