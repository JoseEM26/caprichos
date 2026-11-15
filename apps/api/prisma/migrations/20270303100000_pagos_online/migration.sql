-- Pago en línea con Culqi (tarjeta y Yape) para la carta web. Apagado por defecto.
CREATE TABLE "pago_online_intento" (
    "id" BIGSERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'CULQI',
    "modo" TEXT NOT NULL,
    "monto_centimos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "medio" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'CREADO',
    "mensaje" TEXT,
    "culqi_cargo_id" TEXT,
    "marca" TEXT,
    "ultimos4" TEXT,
    "cobrado_en" TIMESTAMPTZ,
    "cobro_error" TEXT,
    "devuelto_centimos" INTEGER NOT NULL DEFAULT 0,
    "devoluciones" JSONB NOT NULL DEFAULT '[]',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobado_en" TIMESTAMPTZ,
    CONSTRAINT "pago_online_intento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pago_online_intento_clave_key" ON "pago_online_intento"("clave");
CREATE UNIQUE INDEX "pago_online_intento_culqi_cargo_id_key" ON "pago_online_intento"("culqi_cargo_id");
CREATE INDEX "ix_pago_online_intento_pedido" ON "pago_online_intento"("pedido_id");
CREATE INDEX "ix_pago_online_intento_creado" ON "pago_online_intento"("creado_en");
-- Un solo intento vivo por pedido: no se puede cobrar dos veces el mismo pedido
CREATE UNIQUE INDEX "pago_online_intento_vivo_key" ON "pago_online_intento"("pedido_id")
  WHERE "estado" IN ('CREADO', 'PROCESANDO', 'PENDIENTE', 'APROBADO');
ALTER TABLE "pago_online_intento" ADD CONSTRAINT "pago_online_intento_pedido_id_fkey"
  FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pago_online_intento" ADD CONSTRAINT "pago_online_intento_monto_chk" CHECK ("monto_centimos" > 0 AND "devuelto_centimos" >= 0 AND "devuelto_centimos" <= "monto_centimos");

CREATE TABLE "pago_online_evento" (
    "id" BIGSERIAL NOT NULL,
    "evento_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "error" TEXT,
    "recibido_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado_en" TIMESTAMPTZ,
    CONSTRAINT "pago_online_evento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pago_online_evento_evento_id_key" ON "pago_online_evento"("evento_id");

-- Función apagada por defecto; si ya existía la clave, no se toca
INSERT INTO "parametro" ("clave", "valor") VALUES ('pago_online_activo', '"no"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- Minutos que un pedido con «Tarjeta / Yape en línea» espera el pago antes de anularse solo
INSERT INTO "parametro" ("clave", "valor") VALUES ('pago_online_espera_min', '15'::jsonb)
ON CONFLICT ("clave") DO NOTHING;

-- Cuenta «Pago en línea»: figura como quien cobra los pagos de Culqi y como quien anula los pedidos sin pago.
-- Rol ADMIN (no se crea un rol nuevo), INACTIVA y con un hash que no es una contraseña: nadie puede iniciar sesión.
-- Se reconoce por ese hash y no aparece en Usuarios. Idempotente: si ya existe, no se crea otra.
-- En una base nueva los roles los siembra la app al arrancar: se asegura ADMIN sin tocar uno existente.
INSERT INTO "rol" ("codigo", "nombre") VALUES ('ADMIN', 'Administrador') ON CONFLICT ("codigo") DO NOTHING;

DO $$
DECLARE nuevo BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user_account" WHERE "hash" = '!pago-en-linea-sin-acceso') THEN
    INSERT INTO "party" ("tipo", "estado") VALUES ('PERSONA', 'ACTIVO') RETURNING "id" INTO nuevo;
    INSERT INTO "person" ("party_id", "nombres") VALUES (nuevo, 'Pago en línea');
    INSERT INTO "user_account" ("party_id", "rol", "hash", "debe_cambiar", "activo")
      VALUES (nuevo, 'ADMIN', '!pago-en-linea-sin-acceso', false, false);
  END IF;
END $$;
