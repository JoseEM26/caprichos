-- AlterTable user_account
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "alertas_whatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "alertas_whatsapp_confirmado_en" TIMESTAMPTZ;

-- Semillas de configuracion para alertas y tiempos de espera (tabla parametro)
INSERT INTO "parametro" ("clave", "valor") VALUES ('alerta_voucher_min_1', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('alerta_voucher_min_2', '15'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('espera_cliente_aviso_min', '10'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('chat_tomado_liberar_min', '10'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('alerta_pedido_sin_confirmar_min', '5'::jsonb) ON CONFLICT ("clave") DO NOTHING;
