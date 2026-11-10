-- Cerrar todas las sesiones de un usuario al instante (aditiva, sin tocar filas existentes)
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "sesiones_cerradas_en" TIMESTAMPTZ;
