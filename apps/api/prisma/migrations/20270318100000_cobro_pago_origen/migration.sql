-- Origen del renglón de pago: MANUAL (Caja/mozo: Yape, tarjeta POS, etc.) o CULQI (pago en línea aprobado por la pasarela).
-- Permite separar en Caja y en el cierre lo que llegó a la cuenta de Culqi de lo que llegó al Yape o al POS del local.
ALTER TABLE "cobro_pago" ADD COLUMN "origen" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "cobro_pago" ADD CONSTRAINT "cobro_pago_origen_check" CHECK ("origen" IN ('MANUAL', 'CULQI'));

-- Backfill: renglones de cobros ligados a un pago en línea aprobado (o ya devuelto) por Culqi
UPDATE "cobro_pago" cp
SET "origen" = 'CULQI'
FROM "cobro" c
WHERE cp."cobro_id" = c."id"
  AND cp."medio" IN ('YAPE', 'TARJETA')
  AND EXISTS (
    SELECT 1 FROM "pago_online_intento" i
    WHERE i."pedido_id" = c."pedido_id"
      AND i."estado" IN ('APROBADO', 'DEVUELTO')
      AND i."cobrado_en" IS NOT NULL
      AND i."medio" = cp."medio"
  );
