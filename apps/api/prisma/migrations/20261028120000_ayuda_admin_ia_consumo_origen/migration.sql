-- AlterTable
ALTER TABLE "ia_consumo" ADD COLUMN "origen" VARCHAR(50) NOT NULL DEFAULT 'CHATBOT';

-- CreateIndex
CREATE INDEX "ia_consumo_origen_idx" ON "ia_consumo"("origen");

-- Parametros de configuracion para el asistente de ayuda del admin
INSERT INTO "parametro" ("clave", "valor") VALUES ('ayuda_ia_activo', 'false'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('ayuda_ia_max_por_minuto_usuario', '20'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('ayuda_ia_max_por_hora_usuario', '200'::jsonb) ON CONFLICT ("clave") DO NOTHING;
