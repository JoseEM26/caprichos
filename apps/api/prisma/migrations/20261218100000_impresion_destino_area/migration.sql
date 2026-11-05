-- Ruteo de stickers por destino: NULL = Caja (la etiquetera de Caja). Solo aditivo.
ALTER TABLE "print_job" ADD COLUMN "destino_area_id" BIGINT;

CREATE INDEX "print_job_destino_area_id_estado_idx" ON "print_job"("destino_area_id", "estado");

ALTER TABLE "print_job" ADD CONSTRAINT "print_job_destino_area_id_fkey"
  FOREIGN KEY ("destino_area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;
