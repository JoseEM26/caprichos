-- Tabla aditiva para código rotativo general del supervisor cifrado (AES-256-GCM)
CREATE TABLE IF NOT EXISTS "supervisor_secreto" (
    "id" BIGSERIAL NOT NULL,
    "local_codigo" TEXT NOT NULL DEFAULT 'CAPRICHOS',
    "secreto_cifrado" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "creado_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_secreto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_secreto_local_codigo_key" ON "supervisor_secreto"("local_codigo");
