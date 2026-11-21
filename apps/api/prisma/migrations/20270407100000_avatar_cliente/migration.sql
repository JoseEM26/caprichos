-- Avatar 3D del cliente en la carta: configuración (JSON) y URL del retrato PNG. Aditiva (columnas nulas).
ALTER TABLE "person" ADD COLUMN "avatar_config" JSONB;
ALTER TABLE "person" ADD COLUMN "avatar_url" TEXT;
