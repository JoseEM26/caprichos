-- Eventos anónimos de la carta (embudo de visitas). Sin celular, nombre, IP ni user-agent: solo un id aleatorio de sesión
-- de navegador, el tipo de dispositivo y si había sesión. Retención de 120 días (limpieza automática). Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS "carta_evento" (
  "id" BIGSERIAL PRIMARY KEY,
  "sesion_id" VARCHAR(40),
  "evento" VARCHAR(20) NOT NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "dispositivo" VARCHAR(12) NOT NULL DEFAULT 'DESCONOCIDO',
  "con_sesion" BOOLEAN NOT NULL DEFAULT false,
  "pedido_id" BIGINT
);
CREATE INDEX IF NOT EXISTS "carta_evento_creado_en_idx" ON "carta_evento"("creado_en");
CREATE INDEX IF NOT EXISTS "carta_evento_sesion_id_idx" ON "carta_evento"("sesion_id");
-- un pedido enlaza una sola vez (el reintento idempotente del pedido no duplica el evento)
CREATE UNIQUE INDEX IF NOT EXISTS "carta_evento_pedido_id_key" ON "carta_evento"("pedido_id") WHERE "pedido_id" IS NOT NULL;
