-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- CreateTable
CREATE TABLE "zona_reparto" (
    "id" BIGSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "poligono" JSONB NOT NULL,
    "tarifa" DECIMAL(12,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "zona_reparto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id" BIGSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'CARTA',
    "modalidad" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'COLA',
    "party_id" BIGINT,
    "es_personal" BOOLEAN NOT NULL DEFAULT false,
    "cliente_nombre" TEXT,
    "cliente_telefono" TEXT,
    "entrega_direccion" TEXT,
    "entrega_referencia" TEXT,
    "entrega_lat" DECIMAL(9,6),
    "entrega_lng" DECIMAL(9,6),
    "entrega_origen" TEXT,
    "zona_id" BIGINT,
    "pago_metodo" TEXT,
    "pago_estado" TEXT DEFAULT 'PENDIENTE',
    "pago_preferido" TEXT,
    "paga_con" DECIMAL(12,2),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "envio" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "comprobante_tipo" TEXT NOT NULL DEFAULT 'BOLETA',
    "comprobante_doc" TEXT,
    "comprobante_razon" TEXT,
    "nota" TEXT,
    "clave_idempotencia" TEXT,
    "pago_coordinado_en" TIMESTAMPTZ,
    "pago_coordinado_por" BIGINT,
    "despachado_en" TIMESTAMPTZ,
    "despachado_por" BIGINT,
    "confirmado_en" TIMESTAMPTZ,
    "confirmado_por" BIGINT,
    "pasa_cocina_en" TIMESTAMPTZ,
    "listo_en" TIMESTAMPTZ,
    "entregado_en" TIMESTAMPTZ,
    "anulado_en" TIMESTAMPTZ,
    "anulado_por" BIGINT,
    "motivo_anulacion" TEXT,
    "anulacion_aprobada_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_linea" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "producto_id" BIGINT,
    "nombre" TEXT NOT NULL,
    "tamano" TEXT,
    "opciones" JSONB NOT NULL DEFAULT '[]',
    "sabor" TEXT,
    "nota" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precio_unit" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2),
    "area_id" BIGINT,
    "adicional" BOOLEAN NOT NULL DEFAULT false,
    "nombres_persona" TEXT[],

    CONSTRAINT "pedido_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_linea_opcion" (
    "id" BIGSERIAL NOT NULL,
    "pedido_linea_id" BIGINT NOT NULL,
    "opcion_id" BIGINT,
    "grupo_nombre" TEXT NOT NULL,
    "opcion_nombre" TEXT NOT NULL,
    "precio_unit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_extra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nombre_persona" TEXT,

    CONSTRAINT "pedido_linea_opcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_estado_historial" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT NOT NULL,
    "motivo" TEXT,
    "por_party_id" BIGINT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencia_pedido" (
    "nombre" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secuencia_pedido_pkey" PRIMARY KEY ("nombre")
);

-- CreateIndex
CREATE UNIQUE INDEX "zona_reparto_codigo_key" ON "zona_reparto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_codigo_key" ON "pedido"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_clave_idempotencia_key" ON "pedido"("clave_idempotencia");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_zona_id_fkey" FOREIGN KEY ("zona_id") REFERENCES "zona_reparto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea" ADD CONSTRAINT "pedido_linea_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea" ADD CONSTRAINT "pedido_linea_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea" ADD CONSTRAINT "pedido_linea_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea_opcion" ADD CONSTRAINT "pedido_linea_opcion_pedido_linea_id_fkey" FOREIGN KEY ("pedido_linea_id") REFERENCES "pedido_linea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_linea_opcion" ADD CONSTRAINT "pedido_linea_opcion_opcion_id_fkey" FOREIGN KEY ("opcion_id") REFERENCES "opcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_estado_historial" ADD CONSTRAINT "pedido_estado_historial_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa (DDL de referencia DAT-CAP-001)
ALTER TABLE "zona_reparto" ADD CONSTRAINT ck_zona_reparto_codigo CHECK (codigo IN ('Z2','Z3','Z4','Z5','Z6','Z7'));
ALTER TABLE "zona_reparto" ADD CONSTRAINT ck_zona_reparto_tarifa CHECK (tarifa >= 0);

ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_canal CHECK (canal IN ('CARTA','BOT','TELEFONO','MOSTRADOR','MOZO'));
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_modalidad CHECK (modalidad IN ('DELIVERY','RECOGER','MESA','LLEVAR'));
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_estado CHECK (estado IN ('COLA','PREPARANDO','POR_CONFIRMAR','EN_COCINA','LISTO','EN_CAMINO','ENTREGADO','EN_COORDINACION','COBRADO','RECHAZADO','ANULADO'));
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_entrega_origen CHECK (entrega_origen IS NULL OR entrega_origen IN ('GPS','ESCRITA','MAPA','WHATSAPP','ENLACE','ASESOR'));
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_comprobante_tipo CHECK (comprobante_tipo IN ('NOTA_VENTA','BOLETA','FACTURA'));
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_subtotal CHECK (subtotal >= 0);
ALTER TABLE "pedido" ADD CONSTRAINT ck_pedido_total CHECK (total >= 0);

ALTER TABLE "pedido_linea" ADD CONSTRAINT ck_pedido_linea_cantidad CHECK (cantidad > 0);
ALTER TABLE "pedido_linea" ADD CONSTRAINT ck_pedido_linea_precio_unit CHECK (precio_unit >= 0);

ALTER TABLE "pedido_linea_opcion" ADD CONSTRAINT ck_pedido_linea_opcion_precio_extra CHECK (precio_extra >= 0);

-- Secuencia para correlativo del código de pedido de la carta (CP-W###)
CREATE SEQUENCE IF NOT EXISTS sec_pedido_codigo START WITH 1;

