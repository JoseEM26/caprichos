-- Decisión del dueño (22/11/2026): la IA responde el texto libre del bot de WhatsApp (menús y pedido guiado siguen igual).
-- Enciende la IA y la conversación libre. La clave de OpenAI (OPENAI_API_KEY) sigue siendo variable de entorno: sin ella la IA no actúa.
-- Para apagarla: Configuración > Chatbot > Asistente de IA (o chatbot_ia_activo = "no").
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('chatbot_ia_activo', '"si"'::jsonb),
  ('chatbot_modo_libre', '"si"'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
