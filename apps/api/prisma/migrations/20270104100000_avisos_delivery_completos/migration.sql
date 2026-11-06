-- Avisos del delivery al cliente completos (decisión del dueño, 06/11/2026): quedan encendidos
-- «ya asignamos a tu delivery», «salió» (con tiempo estimado y enlace de seguimiento), «llegó» y «entregado».
-- La migración 20261209100000 había apagado SALIDA y ENTREGADO: por eso el cliente solo recibía el de la llegada.
-- La encuesta posventa no se toca. Cada uno se puede apagar desde Parámetros › Avisos.
UPDATE "parametro"
SET "valor" = '"si"'::jsonb
WHERE "clave" IN ('whatsapp_aviso_salida_activo', 'whatsapp_aviso_entregado_activo');

INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_aviso_asignado_activo', '"si"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- La etapa 15 (ASIGNADO) de mensaje_reparto: el CHECK de numero admitía solo 1 a 14
ALTER TABLE "mensaje_reparto" DROP CONSTRAINT IF EXISTS "ck_mensaje_reparto_numero";
ALTER TABLE "mensaje_reparto" ADD CONSTRAINT "ck_mensaje_reparto_numero" CHECK ("numero" BETWEEN 1 AND 15);
