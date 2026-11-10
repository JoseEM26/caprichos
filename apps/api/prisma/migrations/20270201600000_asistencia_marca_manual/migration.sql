-- Marca manual sin QR (solo GPS en el radio, sin selfie): origen MANUAL, queda A_REVISAR hasta que el admin la apruebe.
ALTER TABLE "asistencia_marca" DROP CONSTRAINT IF EXISTS "asistencia_marca_origen_check";
ALTER TABLE "asistencia_marca" ADD CONSTRAINT "asistencia_marca_origen_check" CHECK ("origen" IN ('CELULAR', 'CORRECCION', 'WEB', 'MANUAL'));
