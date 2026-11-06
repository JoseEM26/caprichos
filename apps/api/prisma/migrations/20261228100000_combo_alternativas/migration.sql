-- Alternativas de una parte de combo (antes solo «plan B» de las partes FIJO).
-- Cada alternativa tiene su producto y su cantidad: «2 donas» puede tener «2 galletas», «1 carrot cake», «1 queque».
-- Aditiva e idempotente: columna con default 1 (las filas de plan B existentes quedan con cantidad 1, como antes).
-- Solo se aplica a combo_parte_reemplazo; no toca partes ni ofertas.

ALTER TABLE "combo_parte_reemplazo" ADD COLUMN IF NOT EXISTS "cantidad" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_combo_parte_reemplazo_cantidad') THEN
    ALTER TABLE "combo_parte_reemplazo"
      ADD CONSTRAINT "ck_combo_parte_reemplazo_cantidad" CHECK ("cantidad" > 0);
  END IF;
END $$;
