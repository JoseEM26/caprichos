-- Decisión del dueño (14/11/2026): boletas y facturas se emiten AL INSTANTE, al cobrar (así salen dentro de la
-- ventana de 24 h de WhatsApp). El envío de la noche queda apagado; se puede volver a activar en
-- Comprobantes > Electrónicos > «Cuándo se emiten».
INSERT INTO "parametro" ("clave", "valor") VALUES ('facturacion_envio_nocturno', '"no"'::jsonb)
ON CONFLICT ("clave") DO UPDATE SET "valor" = '"no"'::jsonb;
