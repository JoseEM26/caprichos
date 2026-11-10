-- Tipo de marca declarado por la persona (ENTRADA | SALIDA | ALMUERZO_SALIDA | ALMUERZO_VUELTA). Aditiva e idempotente:
-- las marcas existentes quedan en NULL y se siguen interpretando por orden y pares.
ALTER TABLE "asistencia_marca" ADD COLUMN IF NOT EXISTS "tipo_marca" VARCHAR(16);
