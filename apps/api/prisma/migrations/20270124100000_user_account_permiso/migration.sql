-- PERMISOS EXTRA POR PERSONA (aditiva e idempotente)
-- Permiso (modulo/accion del catálogo) que se suma a los de los roles de la cuenta; vence_en NULL = hasta que el ADMIN lo quite.
CREATE TABLE IF NOT EXISTS "user_account_permiso" (
    "user_account_id" BIGINT NOT NULL,
    "modulo" VARCHAR(40) NOT NULL,
    "accion" VARCHAR(40) NOT NULL,
    "otorgado_por" BIGINT,
    "otorgado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "vence_en" TIMESTAMPTZ,
    "nota" TEXT,
    CONSTRAINT "user_account_permiso_pkey" PRIMARY KEY ("user_account_id", "modulo", "accion")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_account_permiso_user_account_id_fkey') THEN
    ALTER TABLE "user_account_permiso" ADD CONSTRAINT "user_account_permiso_user_account_id_fkey"
      FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ix_user_account_permiso_cuenta" ON "user_account_permiso" ("user_account_id");
