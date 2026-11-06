-- ROLES TEMPORALES Y HISTORIAL DE ROLES (aditiva e idempotente)
--
-- 1. user_account_rol: cada rol extra guarda quién lo dio, cuándo, por qué y hasta cuándo vale.
--    vence_en NULL = permanente (hasta que el ADMIN lo quite). Un rol vencido deja de contar
--    (rolesDeCuenta filtra por vigencia) y la app lo borra y lo anota en el historial.
-- 2. user_account_rol_historial: registro permanente e INMUTABLE (trigger) de cada otorgamiento,
--    retiro o vencimiento de un rol extra. Nunca se borra ni se edita.
-- Sin datos que migrar: las filas existentes quedan permanentes (vence_en NULL).

ALTER TABLE "user_account_rol" ADD COLUMN IF NOT EXISTS "otorgado_por" BIGINT;
ALTER TABLE "user_account_rol" ADD COLUMN IF NOT EXISTS "otorgado_en" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "user_account_rol" ADD COLUMN IF NOT EXISTS "vence_en" TIMESTAMPTZ;
ALTER TABLE "user_account_rol" ADD COLUMN IF NOT EXISTS "motivo" TEXT;

CREATE TABLE IF NOT EXISTS "user_account_rol_historial" (
    "id" BIGSERIAL NOT NULL,
    "user_account_id" BIGINT NOT NULL,
    "rol" TEXT NOT NULL,
    "accion" VARCHAR(12) NOT NULL,
    "quien_party_id" BIGINT,
    "desde" TIMESTAMPTZ,
    "hasta" TIMESTAMPTZ,
    "motivo" TEXT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "user_account_rol_historial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_account_rol_historial_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_account_rol_historial_rol_fkey" FOREIGN KEY ("rol") REFERENCES "rol"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_account_rol_historial_accion') THEN
    ALTER TABLE "user_account_rol_historial" ADD CONSTRAINT ck_user_account_rol_historial_accion
      CHECK (accion IN ('OTORGADO', 'RETIRADO', 'VENCIDO'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ix_user_account_rol_historial_cuenta" ON "user_account_rol_historial" ("user_account_id", "en");
CREATE INDEX IF NOT EXISTS "ix_user_account_rol_vence" ON "user_account_rol" ("vence_en") WHERE "vence_en" IS NOT NULL;

CREATE OR REPLACE FUNCTION user_account_rol_historial_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'El historial de roles no se edita ni se borra';
END;
$$;

DROP TRIGGER IF EXISTS tg_user_account_rol_historial_inmutable ON "user_account_rol_historial";
CREATE TRIGGER tg_user_account_rol_historial_inmutable
  BEFORE UPDATE OR DELETE ON "user_account_rol_historial"
  FOR EACH ROW EXECUTE FUNCTION user_account_rol_historial_inmutable();

-- INICIATIVAS: todo el personal ve, crea y comenta; cambiar el estado, solo ADMIN y SUPERVISOR.
-- Aditivo: nunca quita vínculos que la base ya tenga. El sincronizador de arranque hace lo mismo.
INSERT INTO "permiso" ("modulo", "accion") VALUES
  ('iniciativas', 'ver'),
  ('iniciativas', 'crear'),
  ('iniciativas', 'comentar'),
  ('iniciativas', 'cambiar_estado')
ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "rol" r
JOIN "permiso" p ON p."modulo" = 'iniciativas' AND p."accion" IN ('ver', 'crear', 'comentar')
ON CONFLICT DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "rol" r
JOIN "permiso" p ON p."modulo" = 'iniciativas' AND p."accion" = 'cambiar_estado'
WHERE r."codigo" IN ('ADMIN', 'SUPERVISOR')
ON CONFLICT DO NOTHING;
