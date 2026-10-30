-- Parametro del corte automatico de la lectura de vouchers con IA (aditivo, idempotente).
-- voucher_ia_corte_min: minutos que la lectura queda en pausa tras 3 fallos de saldo o clave
-- (o 5 errores seguidos) de OpenAI. ON CONFLICT DO NOTHING: no pisa lo que el dueño ya haya configurado.
INSERT INTO "parametro" ("clave", "valor") VALUES ('voucher_ia_corte_min', '10'::jsonb) ON CONFLICT ("clave") DO NOTHING;
