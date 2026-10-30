-- Inserción aditiva de parámetros operativos para flujo de pago por WhatsApp (FT-BOT-02, HU-CAP-130..132)

INSERT INTO "parametro" ("clave", "valor")
VALUES ('chatbot_pago_recordatorio_activo', '"si"')
ON CONFLICT ("clave") DO NOTHING;

INSERT INTO "parametro" ("clave", "valor")
VALUES ('chatbot_pago_recordatorio_min', '10')
ON CONFLICT ("clave") DO NOTHING;

INSERT INTO "parametro" ("clave", "valor")
VALUES ('chatbot_pago_expira_min', '30')
ON CONFLICT ("clave") DO NOTHING;
