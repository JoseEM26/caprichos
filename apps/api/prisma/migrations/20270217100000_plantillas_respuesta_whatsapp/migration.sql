-- Plantillas de respuesta rápida del equipo en la bandeja de Mensajes: se amplía respuesta_rapida (categoría, orden,
-- quién creó/editó, fechas) y se siembran ejemplos con variables ({{nombre}}, {{medios_pago}}...), sin datos reales.
-- Aditiva e idempotente: los ejemplos solo entran si no existe una plantilla con ese título (las editadas no se pisan).
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(20);
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "orden" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "creado_por" BIGINT;
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "actualizado_por" BIGINT;
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "respuesta_rapida" ADD COLUMN IF NOT EXISTS "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Las respuestas de la semilla antigua con datos de relleno (dirección y número falsos) pasan a leer los datos reales del local.
UPDATE "respuesta_rapida" SET "texto" = $t$Nos encuentras en {{direccion}} 📍 ¡Te esperamos en {{local}}! ☕$t$, "categoria" = 'UBICACION'
  WHERE "titulo" = 'Ubicación del local' AND "texto" LIKE '%Av. Principal 123%';
UPDATE "respuesta_rapida" SET "texto" = $t$Para pagar con Yape o Plin 📲
{{medios_pago}}

Cuando lo hagas, envíanos la captura por aquí 🙏$t$, "categoria" = 'PAGOS'
  WHERE "titulo" = 'Datos para pago Yape/Plin' AND "texto" LIKE '%987654321%';
UPDATE "respuesta_rapida" SET "categoria" = 'HORARIOS'
  WHERE "titulo" = 'Horario de atención' AND "categoria" IS NULL AND "texto" LIKE 'Nuestro horario de atención es de Lunes a Domingo%';

INSERT INTO "respuesta_rapida" ("titulo", "texto", "categoria", "orden", "activo") VALUES
  ($t$Saludo con nombre$t$, $t$¡Hola {{nombre}}! 😊 Soy {{mi_nombre}} de {{local}}. ¿En qué te puedo ayudar hoy? 🧁$t$, 'SALUDO', 10, true),
  ($t$Un momento por favor$t$, $t$Claro que sí, {{nombre}}. Dame un momentito y te confirmo 🙌$t$, 'SALUDO', 20, true),
  ($t$Medios de pago$t$, $t$Puedes pagar con 💳
{{medios_pago}}

Cuando pagues, envíanos la captura del voucher por aquí, por favor 🙏$t$, 'PAGOS', 30, true),
  ($t$Datos para Yape$t$, $t$Para pagar con Yape 📲
{{yape}}

Cuando lo hagas, envíanos la captura por aquí 🙏$t$, 'PAGOS', 40, true),
  ($t$Datos para Plin$t$, $t$Para pagar con Plin 📲
{{plin}}

Cuando lo hagas, envíanos la captura por aquí 🙏$t$, 'PAGOS', 50, true),
  ($t$Datos para transferencia$t$, $t$Para pagar por transferencia 🏦
{{transferencia}}

Cuando la hagas, envíanos la captura por aquí 🙏$t$, 'PAGOS', 60, true),
  ($t$Tarjeta o efectivo$t$, $t$También puedes pagar con tarjeta o en efectivo al recibir tu pedido o en el local 😊 Si es en efectivo, dinos con cuánto pagas para llevar tu vuelto.$t$, 'PAGOS', 70, true),
  ($t$Enviar voucher de pago$t$, $t$Cuando hayas pagado, envíanos aquí la foto o captura del voucher 📸 Así confirmamos tu pedido enseguida.$t$, 'PAGOS', 80, true),
  ($t$Horario de atención$t$, $t$Estamos atendiendo en este horario 🕒
{{horario}}$t$, 'HORARIOS', 90, true),
  ($t$Ubicación y cómo llegar$t$, $t$Nos encuentras en {{direccion}} 📍 ¡Te esperamos en {{local}}! ☕$t$, 'UBICACION', 100, true),
  ($t$Pedir ubicación para delivery$t$, $t$Para llevarte tu pedido, ¿nos compartes tu ubicación por WhatsApp? 📍 Toca el clip, elige Ubicación y envíala. Gracias {{nombre}} 😊$t$, 'UBICACION', 110, true),
  ($t$Tiempos y costo de delivery$t$, $t$El delivery tiene un costo según tu zona 🛵 En cuanto nos mandes tu ubicación te confirmamos el costo y el tiempo aproximado de entrega.$t$, 'DELIVERY', 120, true),
  ($t$Confirmar dirección$t$, $t$Para confirmar tu delivery 🛵 ¿La entrega es en esta dirección? Cuéntanos también una referencia (color de la casa, cerca de qué está) para llegar rápido.$t$, 'DELIVERY', 130, true),
  ($t$Pedido recibido$t$, $t$¡Recibimos tu pedido, {{nombre}}! 🎉 Ya lo estamos revisando y te avisamos apenas esté en preparación.$t$, 'PEDIDOS', 140, true),
  ($t$Pedido en preparación$t$, $t$Tu pedido ya está en preparación 👩‍🍳 Te avisamos cuando esté listo.$t$, 'PEDIDOS', 150, true),
  ($t$Pedido listo para recoger$t$, $t$¡Tu pedido está listo, {{nombre}}! 🧁 Puedes pasar a recogerlo en {{direccion}}. Te esperamos.$t$, 'PEDIDOS', 160, true),
  ($t$Pedido en camino$t$, $t$¡Tu pedido va en camino! 🛵 Estate atento al timbre o al celular, por favor.$t$, 'PEDIDOS', 170, true),
  ($t$Producto agotado con alternativa$t$, $t$Disculpa, {{nombre}}, justo se nos agotó ese producto 😔 Te puedo ofrecer una alternativa parecida, ¿te animas? Cuéntame qué prefieres.$t$, 'PEDIDOS', 180, true),
  ($t$Disculpa por demora$t$, $t$Disculpa la demora, {{nombre}} 🙏 Estamos con bastante pedido, pero ya estamos con el tuyo. Gracias por tu paciencia.$t$, 'PEDIDOS', 190, true),
  ($t$Gracias y despedida$t$, $t$¡Gracias por tu pedido, {{nombre}}! 💛 Que lo disfrutes. Aquí estamos para lo que necesites. — {{mi_nombre}}, {{local}}$t$, 'CIERRE', 200, true)
ON CONFLICT ("titulo") DO NOTHING;
