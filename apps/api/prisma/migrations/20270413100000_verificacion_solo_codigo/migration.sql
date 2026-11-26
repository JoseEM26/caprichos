-- Verificación del celular solo con código de 6 dígitos por WhatsApp (decisión del dueño, 25/11/2026).
-- El modo «el cliente escribe al negocio» fallaba con las cuentas que ocultan su número (LID) y confundía con dos caminos.
-- Con Evolution el código sale como texto (sin plantilla de Meta). Para volver: Configuración › verificacion_celular_modo.
INSERT INTO "parametro" ("clave", "valor") VALUES ('verificacion_celular_modo', '"CODIGO_PLANTILLA"')
ON CONFLICT ("clave") DO UPDATE SET "valor" = '"CODIGO_PLANTILLA"';
