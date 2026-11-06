-- PROPINAS (fase 1: captura, acumulación y caja). Aditiva e idempotente.
--
-- 1. pedido.propina: propina opcional del cliente. Va APARTE: no suma a subtotal ni total, no entra a
--    comprobantes/SUNAT/IGV ni genera puntos. El cliente paga total + propina (plan, vouchers y cobro).
-- 2. cobro_pago.propina: parte del renglón cobrado que es propina. monto = venta, propina = propina.
--    Sumar monto + propina da lo que entró por ese medio (efectivo o digital).
-- 3. parámetros: propina_activa (interruptor por canal) y propina_tope (S/ máximo por pedido).
--    Apagado por defecto: no cambia nada hasta encenderlo en Configuración.
-- 4. permiso propinas/ver: ADMIN y CAJERO.
--
-- Clasificación para reset / migración de datos: no hay tablas nuevas; las columnas nuevas son montos
-- (no datos personales ni claves de otras tablas), así que no cambian ninguna lista.
-- Sin datos que migrar: las filas existentes quedan con 0.

ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "propina" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "cobro_pago" ADD COLUMN IF NOT EXISTS "propina" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS "pedido_propina_no_negativa_check";
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_propina_no_negativa_check" CHECK ("propina" >= 0);
ALTER TABLE "cobro_pago" DROP CONSTRAINT IF EXISTS "cobro_pago_propina_no_negativa_check";
ALTER TABLE "cobro_pago" ADD CONSTRAINT "cobro_pago_propina_no_negativa_check" CHECK ("propina" >= 0);

INSERT INTO "parametro" ("clave", "valor") VALUES ('propina_activa', '{"carta": false, "bot": false}'::jsonb) ON CONFLICT ("clave") DO NOTHING;
INSERT INTO "parametro" ("clave", "valor") VALUES ('propina_tope', '200'::jsonb) ON CONFLICT ("clave") DO NOTHING;

INSERT INTO "permiso" ("modulo", "accion") VALUES ('propinas', 'ver') ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "permiso" p
JOIN "rol" r ON r."codigo" IN ('ADMIN', 'CAJERO')
WHERE p."modulo" = 'propinas' AND p."accion" = 'ver'
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
