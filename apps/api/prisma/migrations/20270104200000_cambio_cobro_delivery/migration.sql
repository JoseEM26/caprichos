-- CAMBIO DE FORMA DE PAGO EN LA PUERTA (aditiva e idempotente)
--
-- El cliente acordó un medio (p. ej. efectivo) y al llegar el delivery quiere pagar con otro (Yape, Plin, tarjeta, mixto).
-- El repartidor SOLICITA y Caja valida: hasta entonces el pedido no cambia de medio ni se puede marcar Entregado.
-- solicitud_cambio_cobro es historial inmutable:
--   - una sola solicitud PENDIENTE por pedido (índice único parcial);
--   - una solicitud PENDIENTE solo puede pasar a APROBADA / RECHAZADA / AUTORIZADA_SIN_VALIDAR (y llenar resuelto_*, motivo);
--   - una solicitud resuelta no se edita; ninguna se borra.
-- El pedido en sí no cambia de columnas: al aprobar se reescriben pedido_pago_plan y pago_metodo con las tablas que ya existen.

CREATE TABLE IF NOT EXISTS "solicitud_cambio_cobro" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "solicitado_por_party_id" BIGINT NOT NULL,
    "solicitado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "plan_original" JSONB NOT NULL,
    "plan_solicitado" JSONB NOT NULL,
    "paga_con" DECIMAL(12,2),
    "voucher_ids" BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
    "motivo" TEXT,
    "resuelto_por_party_id" BIGINT,
    "resuelto_en" TIMESTAMPTZ,
    CONSTRAINT "solicitud_cambio_cobro_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "solicitud_cambio_cobro_estado_check" CHECK ("estado" IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'AUTORIZADA_SIN_VALIDAR')),
    CONSTRAINT "solicitud_cambio_cobro_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "solicitud_cambio_cobro_solicitado_por_party_id_fkey" FOREIGN KEY ("solicitado_por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "solicitud_cambio_cobro_resuelto_por_party_id_fkey" FOREIGN KEY ("resuelto_por_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "solicitud_cambio_cobro_pedido_id_idx" ON "solicitud_cambio_cobro" ("pedido_id");
CREATE INDEX IF NOT EXISTS "solicitud_cambio_cobro_estado_idx" ON "solicitud_cambio_cobro" ("estado");
CREATE UNIQUE INDEX IF NOT EXISTS "solicitud_cambio_cobro_pendiente_unica" ON "solicitud_cambio_cobro" ("pedido_id") WHERE "estado" = 'PENDIENTE';

CREATE OR REPLACE FUNCTION solicitud_cambio_cobro_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las solicitudes de cambio de cobro no se borran';
  END IF;
  IF OLD."estado" <> 'PENDIENTE' THEN
    RAISE EXCEPTION 'Una solicitud de cambio de cobro ya resuelta no se edita';
  END IF;
  IF NEW."pedido_id" IS DISTINCT FROM OLD."pedido_id"
     OR NEW."solicitado_por_party_id" IS DISTINCT FROM OLD."solicitado_por_party_id"
     OR NEW."solicitado_en" IS DISTINCT FROM OLD."solicitado_en"
     OR NEW."plan_original" IS DISTINCT FROM OLD."plan_original"
     OR NEW."plan_solicitado" IS DISTINCT FROM OLD."plan_solicitado"
     OR NEW."paga_con" IS DISTINCT FROM OLD."paga_con"
     OR NEW."voucher_ids" IS DISTINCT FROM OLD."voucher_ids" THEN
    RAISE EXCEPTION 'Los datos de la solicitud de cambio de cobro no se editan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_solicitud_cambio_cobro_inmutable ON "solicitud_cambio_cobro";
CREATE TRIGGER tg_solicitud_cambio_cobro_inmutable
  BEFORE UPDATE OR DELETE ON "solicitud_cambio_cobro"
  FOR EACH ROW EXECUTE FUNCTION solicitud_cambio_cobro_inmutable();
