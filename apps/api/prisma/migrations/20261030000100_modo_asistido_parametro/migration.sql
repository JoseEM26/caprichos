-- Semilla de parametro asistido_espera_min para el Modo Asistido del Chatbot
INSERT INTO "parametro" ("clave", "valor") VALUES ('asistido_espera_min', '3'::jsonb) ON CONFLICT ("clave") DO NOTHING;
