-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "cupon_emitido_id" BIGINT,
ADD COLUMN     "cupon_id" BIGINT,
ADD COLUMN     "descuento_detalle" JSONB,
ADD COLUMN     "oferta_id" BIGINT,
ADD COLUMN     "puntos_canjeados" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "puntos_ganados" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pedido_linea" ADD COLUMN     "linea_combo_id" BIGINT,
ADD COLUMN     "oferta_id" BIGINT;

-- AlterTable
ALTER TABLE "person" ADD COLUMN     "correo" TEXT,
ADD COLUMN     "cumple_dia" SMALLINT,
ADD COLUMN     "cumple_mes" SMALLINT,
ADD COLUMN     "foto_archivo_id" BIGINT;

-- CreateTable
CREATE TABLE "customer_account" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "hash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_role" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "rol" TEXT NOT NULL,
    "desde" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" DATE,

    CONSTRAINT "party_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_detail" (
    "party_role_id" BIGINT NOT NULL,
    "puntos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "envio_tipo" TEXT,
    "envio_valor" DECIMAL(12,2),

    CONSTRAINT "customer_detail_pkey" PRIMARY KEY ("party_role_id")
);

-- CreateTable
CREATE TABLE "consent" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "version_texto" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "aceptado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMPTZ,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_mechanism" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "referencia" TEXT,
    "zona_id" BIGINT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contact_mechanism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "lleva" INTEGER,
    "paga" INTEGER,
    "alcance_categoria_id" BIGINT,
    "alcance_producto_id" BIGINT,
    "descuento_tipo" TEXT,
    "descuento_valor" DECIMAL(12,2),
    "compra_minima" DECIMAL(12,2),
    "dias" INTEGER[],
    "hora_desde" TIME,
    "hora_hasta" TIME,
    "fecha_desde" DATE,
    "fecha_hasta" DATE,
    "canales" TEXT[] DEFAULT ARRAY['CARTA', 'ADMIN', 'BOT']::TEXT[],
    "limite_usos" INTEGER,
    "usos_actuales" INTEGER NOT NULL DEFAULT 0,
    "no_suma_beneficios" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_precio" (
    "oferta_id" BIGINT NOT NULL,
    "tamano_valor_id" BIGINT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "combo_precio_pkey" PRIMARY KEY ("oferta_id","tamano_valor_id")
);

-- CreateTable
CREATE TABLE "combo_parte" (
    "id" BIGSERIAL NOT NULL,
    "oferta_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "categorias" BIGINT[],
    "productos" BIGINT[],

    CONSTRAINT "combo_parte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regla_acumulacion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cupon_con_descuento" BOOLEAN NOT NULL DEFAULT false,
    "promo_con_descuento" BOOLEAN NOT NULL DEFAULT false,
    "cupones_por_comprobante" INTEGER NOT NULL DEFAULT 2,
    "texto_pie" TEXT,

    CONSTRAINT "regla_acumulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupon" (
    "id" BIGSERIAL NOT NULL,
    "modo" TEXT NOT NULL,
    "codigo_base" TEXT NOT NULL,
    "descripcion" TEXT,
    "descuento_tipo" TEXT NOT NULL,
    "descuento_valor" DECIMAL(12,2) NOT NULL,
    "compra_minima" DECIMAL(12,2),
    "categoria_id" BIGINT,
    "producto_id" BIGINT,
    "canales" TEXT[] DEFAULT ARRAY['CARTA', 'CAJA', 'BOT']::TEXT[],
    "requiere_cuenta" BOOLEAN NOT NULL DEFAULT false,
    "dias_validez" INTEGER DEFAULT 15,
    "tope_usos" INTEGER,
    "usos_actuales" INTEGER NOT NULL DEFAULT 0,
    "max_por_cliente" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupon_emitido" (
    "id" BIGSERIAL NOT NULL,
    "cupon_id" BIGINT NOT NULL,
    "codigo" TEXT NOT NULL,
    "pedido_origen_id" BIGINT,
    "vence_en" TIMESTAMPTZ,
    "estado" TEXT NOT NULL DEFAULT 'VIGENTE',
    "canjeado_en" TIMESTAMPTZ,
    "pedido_canje_id" BIGINT,
    "motivo_anulacion" TEXT,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupon_emitido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupon_canje_compartido" (
    "cupon_id" BIGINT NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "party_id" BIGINT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupon_canje_compartido_pkey" PRIMARY KEY ("cupon_id","pedido_id")
);

-- CreateTable
CREATE TABLE "movimiento_puntos" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "pedido_id" BIGINT,
    "puntos" DECIMAL(12,2) NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_account_party_id_key" ON "customer_account"("party_id");

-- CreateIndex
CREATE INDEX "ix_contacto_valor" ON "contact_mechanism"("tipo", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "oferta_nombre_key" ON "oferta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cupon_codigo_base_key" ON "cupon"("codigo_base");

-- CreateIndex
CREATE UNIQUE INDEX "cupon_emitido_codigo_key" ON "cupon_emitido"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_puntos_pedido_id_tipo_key" ON "movimiento_puntos"("pedido_id", "tipo");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_cupon_emitido_id_fkey" FOREIGN KEY ("cupon_emitido_id") REFERENCES "cupon_emitido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea" ADD CONSTRAINT "pedido_linea_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea" ADD CONSTRAINT "pedido_linea_linea_combo_id_fkey" FOREIGN KEY ("linea_combo_id") REFERENCES "pedido_linea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_role" ADD CONSTRAINT "party_role_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_detail" ADD CONSTRAINT "customer_detail_party_role_id_fkey" FOREIGN KEY ("party_role_id") REFERENCES "party_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_mechanism" ADD CONSTRAINT "contact_mechanism_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_mechanism" ADD CONSTRAINT "contact_mechanism_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zona_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_alcance_categoria_id_fkey" FOREIGN KEY ("alcance_categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_alcance_producto_id_fkey" FOREIGN KEY ("alcance_producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_precio" ADD CONSTRAINT "combo_precio_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_precio" ADD CONSTRAINT "combo_precio_tamano_valor_id_fkey" FOREIGN KEY ("tamano_valor_id") REFERENCES "lista_valor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_parte" ADD CONSTRAINT "combo_parte_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon" ADD CONSTRAINT "cupon_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon" ADD CONSTRAINT "cupon_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_emitido" ADD CONSTRAINT "cupon_emitido_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_emitido" ADD CONSTRAINT "cupon_emitido_pedido_origen_id_fkey" FOREIGN KEY ("pedido_origen_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_emitido" ADD CONSTRAINT "cupon_emitido_pedido_canje_id_fkey" FOREIGN KEY ("pedido_canje_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_canje_compartido" ADD CONSTRAINT "cupon_canje_compartido_cupon_id_fkey" FOREIGN KEY ("cupon_id") REFERENCES "cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_canje_compartido" ADD CONSTRAINT "cupon_canje_compartido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_canje_compartido" ADD CONSTRAINT "cupon_canje_compartido_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_puntos" ADD CONSTRAINT "movimiento_puntos_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_puntos" ADD CONSTRAINT "movimiento_puntos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones CHECK, índices condicionales y reglas de negocio
ALTER TABLE "person"
  ADD CONSTRAINT "ck_person_cumple_dia" CHECK ("cumple_dia" IS NULL OR ("cumple_dia" BETWEEN 1 AND 31)),
  ADD CONSTRAINT "ck_person_cumple_mes" CHECK ("cumple_mes" IS NULL OR ("cumple_mes" BETWEEN 1 AND 12));

ALTER TABLE "party_role"
  ADD CONSTRAINT "ck_party_role_rol" CHECK ("rol" IN ('CLIENTE', 'TRABAJADOR', 'PROVEEDOR'));

CREATE UNIQUE INDEX "ux_rol_vigente" ON "party_role" ("party_id", "rol") WHERE "hasta" IS NULL;

ALTER TABLE "customer_detail"
  ADD CONSTRAINT "ck_customer_detail_puntos" CHECK ("puntos" >= 0),
  ADD CONSTRAINT "ck_customer_detail_envio_tipo" CHECK ("envio_tipo" IS NULL OR "envio_tipo" IN ('FIJO', 'PORCENTAJE'));

ALTER TABLE "consent"
  ADD CONSTRAINT "ck_consent_canal" CHECK ("canal" IN ('CARTA', 'CAJA', 'BOT', 'ADMIN'));

ALTER TABLE "contact_mechanism"
  ADD CONSTRAINT "ck_contact_mechanism_tipo" CHECK ("tipo" IN ('TELEFONO', 'WHATSAPP', 'CORREO', 'DIRECCION'));

ALTER TABLE "oferta"
  ADD CONSTRAINT "ck_oferta_tipo" CHECK ("tipo" IN ('COMBO', 'LLEVA_PAGA', 'DESCUENTO')),
  ADD CONSTRAINT "ck_oferta_descuento_tipo" CHECK ("descuento_tipo" IS NULL OR "descuento_tipo" IN ('PORCENTAJE', 'MONTO')),
  ADD CONSTRAINT "ck_oferta_descuento_valor" CHECK ("descuento_valor" IS NULL OR "descuento_valor" >= 0),
  ADD CONSTRAINT "ck_oferta_compra_minima" CHECK ("compra_minima" IS NULL OR "compra_minima" >= 0),
  ADD CONSTRAINT "ck_oferta_limite_usos" CHECK ("limite_usos" IS NULL OR "limite_usos" >= 0),
  ADD CONSTRAINT "ck_oferta_usos_actuales" CHECK ("usos_actuales" >= 0),
  ADD CONSTRAINT "ck_oferta_orden" CHECK ("orden" >= 0);

ALTER TABLE "combo_precio"
  ADD CONSTRAINT "ck_combo_precio_precio" CHECK ("precio" >= 0);

ALTER TABLE "combo_parte"
  ADD CONSTRAINT "ck_combo_parte_tipo" CHECK ("tipo" IN ('A_ELECCION', 'UNA_DE', 'FIJO')),
  ADD CONSTRAINT "ck_combo_parte_cantidad" CHECK ("cantidad" > 0);

ALTER TABLE "regla_acumulacion"
  ADD CONSTRAINT "ck_regla_acumulacion_id" CHECK ("id" = 1),
  ADD CONSTRAINT "ck_regla_acumulacion_cupones" CHECK ("cupones_por_comprobante" >= 0);

ALTER TABLE "cupon"
  ADD CONSTRAINT "ck_cupon_modo" CHECK ("modo" IN ('UNICO_COMPROBANTE', 'COMPARTIDO')),
  ADD CONSTRAINT "ck_cupon_descuento_tipo" CHECK ("descuento_tipo" IN ('PORCENTAJE', 'MONTO')),
  ADD CONSTRAINT "ck_cupon_descuento_valor" CHECK ("descuento_valor" >= 0),
  ADD CONSTRAINT "ck_cupon_compra_minima" CHECK ("compra_minima" IS NULL OR "compra_minima" >= 0),
  ADD CONSTRAINT "ck_cupon_compartido_tope" CHECK ("modo" <> 'COMPARTIDO' OR "tope_usos" IS NOT NULL),
  ADD CONSTRAINT "ck_cupon_usos_actuales" CHECK ("usos_actuales" >= 0),
  ADD CONSTRAINT "ck_cupon_orden" CHECK ("orden" >= 0);

ALTER TABLE "cupon_emitido"
  ADD CONSTRAINT "ck_cupon_emitido_estado" CHECK ("estado" IN ('VIGENTE', 'CANJEADO', 'VENCIDO', 'ANULADO'));

ALTER TABLE "movimiento_puntos"
  ADD CONSTRAINT "ck_movimiento_puntos_tipo" CHECK ("tipo" IN ('SUMA', 'REVERSA', 'CANJE', 'DEVOLUCION_CANJE')),
  ADD CONSTRAINT "ck_movimiento_puntos_puntos" CHECK ("puntos" >= 0);

ALTER TABLE "pedido"
  ADD CONSTRAINT "ck_pedido_puntos_ganados" CHECK ("puntos_ganados" >= 0),
  ADD CONSTRAINT "ck_pedido_puntos_canjeados" CHECK ("puntos_canjeados" >= 0);

