-- Producto: «Alcanza para» y alérgenos (para la carta web y las dudas del bot). Aditiva e idempotente.
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "porciones" VARCHAR(60);
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "alergenos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "alergenos_confirmados" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "producto" DROP CONSTRAINT IF EXISTS "producto_alergenos_chk";
ALTER TABLE "producto" ADD CONSTRAINT "producto_alergenos_chk"
  CHECK ("alergenos" <@ ARRAY['MANI','NUECES','LACTEOS','GLUTEN','HUEVO','SOYA','MARISCOS','SESAMO']::TEXT[]);
