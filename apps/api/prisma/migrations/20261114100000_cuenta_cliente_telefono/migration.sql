-- Cuenta de cliente por teléfono (expand). El teléfono (9 dígitos) es único entre cuentas activas.
-- clave_cambiada_en invalida las sesiones emitidas antes de un cambio o recuperación de contraseña.
ALTER TABLE "customer_account" ADD COLUMN "telefono" VARCHAR(9);
ALTER TABLE "customer_account" ADD COLUMN "clave_cambiada_en" TIMESTAMPTZ;
CREATE UNIQUE INDEX "uq_customer_account_telefono_activo" ON "customer_account" ("telefono") WHERE "activo" AND "telefono" IS NOT NULL;
