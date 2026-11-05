-- Corrección de montos digitales del cierre (Yape, Plin, transferencia, tarjeta).
-- Idempotente: se puede volver a ejecutar sin efecto. Solo se inserta: el trigger impide UPDATE y DELETE.

CREATE TABLE IF NOT EXISTS "cierre_ajuste_medio" (
  "id"                      BIGSERIAL PRIMARY KEY,
  "caja_id"                 BIGINT        NOT NULL,
  "medio"                   TEXT          NOT NULL,
  "monto_sistema"           DECIMAL(12,2) NOT NULL,
  "monto_anterior"          DECIMAL(12,2) NOT NULL,
  "monto_nuevo"             DECIMAL(12,2) NOT NULL,
  "motivo"                  TEXT          NOT NULL,
  "por_party_id"            BIGINT        NOT NULL,
  "autorizado_por_party_id" BIGINT        NOT NULL,
  "creado_en"               TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cierre_ajuste_medio_caja_id_idx" ON "cierre_ajuste_medio" ("caja_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cierre_ajuste_medio_caja_id_fkey') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "cierre_ajuste_medio_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cierre_ajuste_medio_por_party_id_fkey') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "cierre_ajuste_medio_por_party_id_fkey" FOREIGN KEY ("por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cierre_ajuste_medio_autorizado_por_party_id_fkey') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "cierre_ajuste_medio_autorizado_por_party_id_fkey" FOREIGN KEY ("autorizado_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cierre_ajuste_medio_medio') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "ck_cierre_ajuste_medio_medio" CHECK ("medio" IN ('YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cierre_ajuste_medio_montos') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "ck_cierre_ajuste_medio_montos" CHECK ("monto_sistema" >= 0 AND "monto_anterior" >= 0 AND "monto_nuevo" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cierre_ajuste_medio_motivo') THEN
    ALTER TABLE "cierre_ajuste_medio"
      ADD CONSTRAINT "ck_cierre_ajuste_medio_motivo" CHECK (char_length(btrim("motivo")) >= 10);
  END IF;
END $$;

-- Historial append-only: ni se edita ni se borra (mismo patrón que cierre_caja)
CREATE OR REPLACE FUNCTION cierre_ajuste_medio_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las correcciones de medios digitales no se editan ni se borran';
END;
$$;

DROP TRIGGER IF EXISTS tg_cierre_ajuste_medio_inmutable ON "cierre_ajuste_medio";
CREATE TRIGGER tg_cierre_ajuste_medio_inmutable
  BEFORE UPDATE OR DELETE ON "cierre_ajuste_medio"
  FOR EACH ROW EXECUTE FUNCTION cierre_ajuste_medio_inmutable();
