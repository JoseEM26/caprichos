-- Expand: reemplazo fijo por dia de la semana. Tabla nueva, no toca datos existentes.
CREATE TABLE "reemplazo_dia" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "reemplaza_party_id" BIGINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "reemplazo_dia_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reemplazo_dia_dia_check" CHECK ("dia_semana" BETWEEN 0 AND 6),
    CONSTRAINT "reemplazo_dia_distinto_check" CHECK ("party_id" <> "reemplaza_party_id")
);

CREATE UNIQUE INDEX "reemplazo_dia_party_id_dia_semana_key" ON "reemplazo_dia"("party_id", "dia_semana");

ALTER TABLE "reemplazo_dia" ADD CONSTRAINT "reemplazo_dia_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reemplazo_dia" ADD CONSTRAINT "reemplazo_dia_reemplaza_party_id_fkey" FOREIGN KEY ("reemplaza_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
