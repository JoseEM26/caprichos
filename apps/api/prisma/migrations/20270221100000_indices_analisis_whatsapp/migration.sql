-- Índices por fecha para Análisis (WhatsApp y Clientes). Idempotente; solo índices, ningún dato cambia.
-- Medido con 500 mil mensajes y 60 mil pedidos: los rangos cortos (7 días) pasan de leer toda la tabla a leer solo el rango
-- (derivaciones 49 -> 18 ms, chats bot/persona 57 -> 20 ms, embudo de la carta 14 -> 0,5 ms). En 92 días el rango abarca casi
-- toda la tabla y la ganancia es pequeña, pero crece con el histórico.
--
-- CREATE INDEX normal (no CONCURRENTLY: no cabe en la transacción de la migración de Prisma). Bloquea escrituras de la tabla
-- mientras se construye (centésimas de segundo con decenas de miles de filas; unos segundos con millones). Si mensaje_chat o
-- pedido llegaran a millones de filas, crearlos antes a mano con CREATE INDEX CONCURRENTLY IF NOT EXISTS y esta migración
-- no hará nada.

CREATE INDEX IF NOT EXISTS "mensaje_chat_en_idx" ON "mensaje_chat" ("en");

-- Notas «Necesita asesor» del bot (derivaciones): son una fracción pequeña de los mensajes.
CREATE INDEX IF NOT EXISTS "mensaje_chat_nota_asesor_idx" ON "mensaje_chat" ("en") WHERE "tipo" = 'SISTEMA' AND "autor" = 'BOT';

CREATE INDEX IF NOT EXISTS "pedido_creado_en_idx" ON "pedido" ("creado_en");
