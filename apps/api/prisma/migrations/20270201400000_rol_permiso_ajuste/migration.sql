-- ROL_PERMISO_AJUSTE (aditiva e idempotente)
-- Cambios del dueño sobre los permisos base del sistema (MATRIZ): CONCEDE agrega, QUITA elimina. El sincronizador
-- de arranque los reaplica tras la base, así un despliegue no pisa lo que el dueño cambió desde Usuarios › Qué ve cada rol.

CREATE TABLE IF NOT EXISTS "rol_permiso_ajuste" (
    "rol" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "efecto" TEXT NOT NULL,
    "creado_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rol_permiso_ajuste_pkey" PRIMARY KEY ("rol", "modulo", "accion"),
    CONSTRAINT "rol_permiso_ajuste_efecto_check" CHECK ("efecto" IN ('CONCEDE', 'QUITA'))
);

DO $$ BEGIN
  ALTER TABLE "rol_permiso_ajuste" ADD CONSTRAINT "rol_permiso_ajuste_rol_fkey"
    FOREIGN KEY ("rol") REFERENCES "rol"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
