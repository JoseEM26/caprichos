-- Motivo corto de un agotado a mano (p. ej. «se acabó la masa»). Idempotente.
-- El regreso ya vive en producto.agotado_hasta (9999-12-31 = hasta que lo reactive una persona).
ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "agotado_motivo" TEXT;
