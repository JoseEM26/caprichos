-- Varios roles por persona y país de nacimiento. El historial laboral va en party_role (rol TRABAJADOR), sin columnas nuevas.
-- Aditiva: el rol principal sigue en user_account.rol; los roles extra van en user_account_rol.
-- El tipo de documento vive en party_identifier.tipo (DNI | CE | CEDULA | PASAPORTE): no cambia el esquema.
-- Operativa: no aplicar a bases sin revisar.
CREATE TABLE IF NOT EXISTS "user_account_rol" (
    "user_account_id" BIGINT NOT NULL,
    "rol" TEXT NOT NULL,
    CONSTRAINT "user_account_rol_pkey" PRIMARY KEY ("user_account_id", "rol"),
    CONSTRAINT "user_account_rol_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_account_rol_rol_fkey" FOREIGN KEY ("rol") REFERENCES "rol"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "pais_nacimiento" TEXT;
