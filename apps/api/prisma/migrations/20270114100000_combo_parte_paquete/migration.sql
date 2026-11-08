-- Combo con «paquetes» (complemento a elegir): varias partes que comparten paquete_grupo se agrupan por paquete_nombre
-- y el cliente elige UN paquete («2 donas», «1 dona + 1 galleta», «1 carrot cake»...).
-- Aditiva e idempotente. Ambas columnas null = parte normal: los combos y pedidos existentes no cambian.

ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "paquete_grupo" TEXT;
ALTER TABLE "combo_parte" ADD COLUMN IF NOT EXISTS "paquete_nombre" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_combo_parte_paquete') THEN
    ALTER TABLE "combo_parte"
      ADD CONSTRAINT "ck_combo_parte_paquete" CHECK (
        ("paquete_grupo" IS NULL AND "paquete_nombre" IS NULL)
        OR (btrim("paquete_grupo") <> '' AND btrim("paquete_nombre") <> '')
      );
  END IF;
END $$;
