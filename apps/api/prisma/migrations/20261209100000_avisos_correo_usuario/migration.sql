-- Avisos del sistema al equipo por correo (Resend). Aditivo e idempotente.
-- 1) Casilla por usuario: recibe los avisos por correo. Por defecto: ADMIN y SUPERVISOR en cuentas existentes.
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "avisos_correo" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "user_account" SET "avisos_correo" = TRUE WHERE "rol" IN ('ADMIN', 'SUPERVISOR') AND "avisos_correo" = FALSE;

-- 2) Registro de envíos (auditoría). Una fila por caso y destinatario: el mismo caso no se manda dos veces.
CREATE TABLE IF NOT EXISTS "correo_envio" (
    "id" BIGSERIAL NOT NULL,
    "clave" VARCHAR(160) NOT NULL,
    "destinatario" VARCHAR(160) NOT NULL,
    "origen" VARCHAR(40) NOT NULL,
    "asunto" VARCHAR(200) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "proveedor_id" VARCHAR(80),
    "error" VARCHAR(200),
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "correo_envio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "correo_envio_clave_destinatario_key" UNIQUE ("clave", "destinatario")
);
CREATE INDEX IF NOT EXISTS "correo_envio_creado_en_idx" ON "correo_envio" ("creado_en");

-- 3) Los avisos por WhatsApp al equipo quedan apagados (el correo no depende de este flag).
UPDATE "parametro" SET "valor" = 'false'::jsonb WHERE "clave" = 'chatbot_avisos_equipo_activo';
