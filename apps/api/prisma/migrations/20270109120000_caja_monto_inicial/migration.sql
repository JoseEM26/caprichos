-- Monto inicial oficial de la caja (soles). Solo el ADMIN lo cambia; quien abre caja con otro monto necesita código de supervisor.
-- Idempotente: 0 = sin monto oficial (como se abría hasta hoy).
INSERT INTO "parametro" ("clave", "valor") VALUES ('caja_monto_inicial', '0'::jsonb) ON CONFLICT ("clave") DO NOTHING;
