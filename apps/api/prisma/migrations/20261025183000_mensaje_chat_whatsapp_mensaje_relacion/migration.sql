-- AlterTable
ALTER TABLE "mensaje_chat" ADD COLUMN IF NOT EXISTS "whatsapp_mensaje_id" BIGINT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mensaje_chat_whatsapp_mensaje_id_idx" ON "mensaje_chat"("whatsapp_mensaje_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensaje_chat_whatsapp_mensaje_id_fkey'
  ) THEN
    ALTER TABLE "mensaje_chat" ADD CONSTRAINT "mensaje_chat_whatsapp_mensaje_id_fkey"
    FOREIGN KEY ("whatsapp_mensaje_id") REFERENCES "whatsapp_mensaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
