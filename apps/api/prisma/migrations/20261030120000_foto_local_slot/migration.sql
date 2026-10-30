-- Fotos del local en el servidor (expand): cada slot de «Fotos del local» (Fachada, Salón principal, ...)
-- ocupa una fila de foto_local. La columna es nula en las filas anteriores y se usa solo para slots nuevos;
-- al reemplazar una foto la fila anterior pierde su slot (no se borra: queda con activo = false).
ALTER TABLE "foto_local" ADD COLUMN "slot" TEXT;
CREATE UNIQUE INDEX "foto_local_slot_key" ON "foto_local"("slot");
