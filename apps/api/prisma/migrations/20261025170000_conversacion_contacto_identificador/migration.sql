-- AlterTable
ALTER TABLE "conversacion" ADD COLUMN "nombre_contacto" TEXT,
ADD COLUMN "nombre_editado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "identificador_tipo" TEXT NOT NULL DEFAULT 'TELEFONO';
