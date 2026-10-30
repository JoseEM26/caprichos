-- AlterTable
ALTER TABLE "oferta" ADD COLUMN "imagen_archivo_id" BIGINT;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_imagen_archivo_id_fkey" FOREIGN KEY ("imagen_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
