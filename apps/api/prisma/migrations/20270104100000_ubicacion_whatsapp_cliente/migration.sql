-- UBICACIÓN DE DELIVERY ENVIADA POR WHATSAPP (aditiva e idempotente)
--
-- El cliente comparte su ubicación por WhatsApp y el sistema la asigna al pedido (o la deja como propuesta para Caja).
-- 1. origen admite WHATSAPP_CLIENTE (además de CAJA y REPARTIDOR).
-- 2. propuesto_por_party_id pasa a ser opcional: un cliente invitado (sin cuenta) no tiene party.
-- 3. fuera_de_zona: la ubicación del cliente cayó fuera de la zona de reparto (queda como propuesta marcada, sin envío).
-- Para fuera de zona no hay zona ni envío: los campos de zona/envío nuevos ya eran opcionales.

ALTER TABLE "pedido_cambio_ubicacion" DROP CONSTRAINT IF EXISTS "pedido_cambio_ubicacion_origen_check";
ALTER TABLE "pedido_cambio_ubicacion"
  ADD CONSTRAINT "pedido_cambio_ubicacion_origen_check" CHECK ("origen" IN ('CAJA', 'REPARTIDOR', 'WHATSAPP_CLIENTE'));

ALTER TABLE "pedido_cambio_ubicacion" ALTER COLUMN "propuesto_por_party_id" DROP NOT NULL;

ALTER TABLE "pedido_cambio_ubicacion" ADD COLUMN IF NOT EXISTS "fuera_de_zona" BOOLEAN NOT NULL DEFAULT false;

-- Con la columna opcional, borrar el party deja la propuesta sin autor (igual que resuelto_por y ajuste_por)
ALTER TABLE "pedido_cambio_ubicacion" DROP CONSTRAINT IF EXISTS "pedido_cambio_ubicacion_propuesto_por_party_id_fkey";
ALTER TABLE "pedido_cambio_ubicacion"
  ADD CONSTRAINT "pedido_cambio_ubicacion_propuesto_por_party_id_fkey" FOREIGN KEY ("propuesto_por_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
