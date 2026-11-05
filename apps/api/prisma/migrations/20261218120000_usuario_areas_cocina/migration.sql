-- Áreas de cocina por usuario (rol COCINA). Aditivo: sin filas, el usuario sigue viendo todas las áreas.
-- Ningún rol ni contraseña cambia. Además, el rol COCINA pasa a llamarse «Cocina (todas las áreas)».
CREATE TABLE "user_account_area" (
    "user_account_id" BIGINT NOT NULL,
    "area_id" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_area_pkey" PRIMARY KEY ("user_account_id", "area_id")
);

CREATE INDEX "user_account_area_area_id_idx" ON "user_account_area"("area_id");

ALTER TABLE "user_account_area" ADD CONSTRAINT "user_account_area_user_account_id_fkey"
  FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_account_area" ADD CONSTRAINT "user_account_area_area_id_fkey"
  FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "rol" SET "nombre" = 'Cocina (todas las áreas)' WHERE "codigo" = 'COCINA';
