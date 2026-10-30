-- AlterTable
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "motivo_derivacion" TEXT;

-- AlterTable
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "conversacion_id" BIGINT;
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "nueva_direccion" TEXT;
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "nueva_referencia" TEXT;
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "nueva_zona_id" BIGINT;
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "nueva_zona_nombre" TEXT;
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "nuevo_envio" DECIMAL(10,2);
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "recargo_envio" DECIMAL(10,2);
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "lat" DECIMAL(10,7);
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "lng" DECIMAL(10,7);
ALTER TABLE "solicitud_cambio" ADD COLUMN IF NOT EXISTS "decidido_en" TIMESTAMPTZ;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitud_cambio_conversacion_id_fkey'
  ) THEN
    ALTER TABLE "solicitud_cambio" ADD CONSTRAINT "solicitud_cambio_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
