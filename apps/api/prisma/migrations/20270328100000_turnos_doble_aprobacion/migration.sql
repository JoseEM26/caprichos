-- Doble aprobación de reemplazos y cambios de turno: una supervisora y un administrador, en cualquier orden.
-- Aditiva: las solicitudes ya aprobadas o rechazadas no cambian (quedan con estos campos en NULL).
ALTER TABLE "solicitud_turno" ADD COLUMN "aprobado_sup_por" BIGINT,
ADD COLUMN "aprobado_sup_en" TIMESTAMPTZ,
ADD COLUMN "aprobado_adm_por" BIGINT,
ADD COLUMN "aprobado_adm_en" TIMESTAMPTZ;

-- Destinatarios de los avisos de turnos (elige Administración en Configuración).
ALTER TABLE "user_account" ADD COLUMN "avisos_turnos" BOOLEAN NOT NULL DEFAULT false;
