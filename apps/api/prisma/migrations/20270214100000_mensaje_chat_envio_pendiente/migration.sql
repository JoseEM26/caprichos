-- Envío de WhatsApp en segundo plano: el trabajador y el barrido de recuperación buscan mensajes salientes que siguen
-- ENCOLADO o ENVIANDO (dentro de mensaje_chat.contenido->>'estado'). Índice PARCIAL: casi vacío (solo lo pendiente),
-- así el barrido cada 30 s no recorre la tabla. Aditiva e idempotente; no cambia ninguna columna ni dato.
CREATE INDEX IF NOT EXISTS "mensaje_chat_envio_pendiente_idx" ON "mensaje_chat"("id")
  WHERE "direccion" = 'SALE' AND ("contenido"->>'estado') IN ('ENCOLADO', 'ENVIANDO');
