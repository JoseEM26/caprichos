-- Motivo de una calificación baja (1-3) de la encuesta posventa, y copia legible en la queja.
ALTER TABLE "encuesta_posventa"
  ADD COLUMN "motivo_codigo" TEXT,
  ADD COLUMN "motivo_texto" TEXT,
  ADD COLUMN "motivo_preguntado_en" TIMESTAMPTZ;

ALTER TABLE "queja_whatsapp" ADD COLUMN "motivo" TEXT;

CREATE INDEX "encuesta_posventa_motivo_preguntado_en_idx" ON "encuesta_posventa"("motivo_preguntado_en");
