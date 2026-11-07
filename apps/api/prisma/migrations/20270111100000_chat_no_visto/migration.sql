-- Chats «no vistos»: última apertura del equipo y marca manual, compartidas por todos. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'conversacion' AND column_name = 'visto_en'
  ) THEN
    ALTER TABLE "conversacion" ADD COLUMN "visto_en" TIMESTAMPTZ;
    -- Lo que ya existe se da por visto: solo lo que llegue desde ahora cuenta como sin ver
    UPDATE "conversacion" SET "visto_en" = now();
  END IF;
END $$;
ALTER TABLE "conversacion" ADD COLUMN IF NOT EXISTS "marcado_no_visto" BOOLEAN NOT NULL DEFAULT false;
