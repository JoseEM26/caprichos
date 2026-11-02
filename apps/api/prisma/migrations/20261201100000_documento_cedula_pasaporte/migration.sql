-- Tipos de documento CEDULA y PASAPORTE para el personal (7 a 12 alfanuméricos).
-- Reemplaza ck_party_identifier de la base (solo DNI, RUC y CE). Ninguna migración posterior lo había cambiado.
ALTER TABLE "party_identifier" DROP CONSTRAINT IF EXISTS ck_party_identifier;
ALTER TABLE "party_identifier" ADD CONSTRAINT ck_party_identifier CHECK (
  (tipo = 'DNI' AND numero ~ '^\d{8}$') OR (tipo = 'RUC' AND numero ~ '^\d{11}$') OR tipo = 'CE'
  OR (tipo IN ('CEDULA', 'PASAPORTE') AND numero ~ '^[A-Za-z0-9]{7,12}$'));
