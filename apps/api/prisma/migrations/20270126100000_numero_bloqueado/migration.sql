-- Lista manual de numeros bloqueados de WhatsApp (idempotente).
CREATE TABLE IF NOT EXISTS "numero_bloqueado" (
    "id" BIGSERIAL NOT NULL,
    "celular" VARCHAR(9) NOT NULL,
    "motivo" VARCHAR(120),
    "bloqueado_por" VARCHAR(120),
    "bloqueado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "numero_bloqueado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "numero_bloqueado_celular_key" ON "numero_bloqueado"("celular");
