-- Preferencias personales de cada usuario (por party), p. ej. «Preguntar antes de despejar» en cocina.
-- Aditivo: no toca filas existentes. Una fila por usuario y clave; valor en JSON.
CREATE TABLE "preferencia_usuario" (
    "party_id" BIGINT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preferencia_usuario_pkey" PRIMARY KEY ("party_id", "clave")
);

ALTER TABLE "preferencia_usuario" ADD CONSTRAINT "preferencia_usuario_party_id_fkey"
  FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
