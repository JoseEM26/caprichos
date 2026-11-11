-- Bandeja de WhatsApp: mensaje_chat no tenía ningún índice por conversación (Postgres no lo crea solo para una FK),
-- así que abrir un chat y listar la bandeja recorrían TODA la tabla. Aditiva e idempotente.
-- Sin CONCURRENTLY a propósito: Prisma ejecuta el archivo entero en una sola sentencia múltiple (transacción implícita)
-- y CONCURRENTLY no puede correr así; la tabla es de decenas de miles de filas y el índice se arma en menos de un segundo.
CREATE INDEX IF NOT EXISTS "mensaje_chat_conversacion_id_id_idx" ON "mensaje_chat"("conversacion_id", "id");
