-- «Resaltar siempre en cocina»: marca manual por opción (no depende del check automático del producto)
ALTER TABLE "opcion" ADD COLUMN IF NOT EXISTS "resaltar_siempre" BOOLEAN NOT NULL DEFAULT false;
