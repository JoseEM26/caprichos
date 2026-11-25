-- Combos por tamaño (descripción, foto, cantidad por parte) e imágenes opcionales en partes, grupos, opciones, sabores y tamaños. Todo opcional.
ALTER TABLE "combo_precio" ADD COLUMN "descripcion" TEXT, ADD COLUMN "foto_archivo_id" BIGINT;
ALTER TABLE "combo_parte" ADD COLUMN "mostrar_imagenes" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "cantidad_por_tamano" JSONB;
ALTER TABLE "grupo_opciones" ADD COLUMN "mostrar_imagenes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "opcion" ADD COLUMN "foto_archivo_id" BIGINT;
ALTER TABLE "sabor" ADD COLUMN "foto_archivo_id" BIGINT;
ALTER TABLE "producto_tamano" ADD COLUMN "foto_archivo_id" BIGINT;
ALTER TABLE "producto" ADD COLUMN "mostrar_imagenes_sabores" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "mostrar_imagenes_tamanos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "combo_precio" ADD CONSTRAINT "combo_precio_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opcion" ADD CONSTRAINT "opcion_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sabor" ADD CONSTRAINT "sabor_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "producto_tamano" ADD CONSTRAINT "producto_tamano_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
