-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- CreateTable
CREATE TABLE "organization" (
    "party_id" BIGINT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "nombre_comercial" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("party_id")
);

-- CreateTable
CREATE TABLE "supplier_detail" (
    "party_role_id" BIGINT NOT NULL,
    "dias_credito" INTEGER NOT NULL DEFAULT 0,
    "cuenta_pago" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_detail_pkey" PRIMARY KEY ("party_role_id")
);

-- CreateTable
CREATE TABLE "employee_detail" (
    "party_role_id" BIGINT NOT NULL,
    "descuento_pct" DECIMAL(5,2),

    CONSTRAINT "employee_detail_pkey" PRIMARY KEY ("party_role_id")
);

-- CreateTable
CREATE TABLE "horario_trabajo" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "entrada" TIME NOT NULL,
    "salida" TIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "horario_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobertura_turno" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "cubre_party_id" BIGINT NOT NULL,
    "reemplaza_party_id" BIGINT,
    "desde" TIME NOT NULL,
    "hasta" TIME NOT NULL,
    "por" BIGINT NOT NULL,

    CONSTRAINT "cobertura_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_proveedor" (
    "id" BIGSERIAL NOT NULL,
    "proveedor_party_id" BIGINT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'POR_RECIBIR',
    "enviado_en" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "motivo_anulacion" TEXT,

    CONSTRAINT "pedido_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_proveedor_linea" (
    "pedido_proveedor_id" BIGINT NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "cantidad_compra" DECIMAL(14,3) NOT NULL,
    "recibido" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_proveedor_linea_pkey" PRIMARY KEY ("pedido_proveedor_id","insumo_id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" BIGSERIAL NOT NULL,
    "proveedor_party_id" BIGINT NOT NULL,
    "pedido_proveedor_id" BIGINT,
    "comprobante_tipo" TEXT NOT NULL,
    "comprobante_numero" TEXT NOT NULL,
    "archivo_id" BIGINT,
    "condicion" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "fecha_compra" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "pagada_en" TIMESTAMPTZ,
    "pagada_por" BIGINT,
    "anulada_en" TIMESTAMPTZ,
    "motivo_anulacion" TEXT,
    "registrado_por" BIGINT,
    "registrado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_linea" (
    "id" BIGSERIAL NOT NULL,
    "compra_id" BIGINT NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "cantidad_compra" DECIMAL(14,3) NOT NULL,
    "costo_unit" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "compra_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traslado" (
    "id" BIGSERIAL NOT NULL,
    "insumo_id" BIGINT NOT NULL,
    "destino_lugar_id" BIGINT NOT NULL,
    "enviado" DECIMAL(14,3) NOT NULL,
    "recibido" DECIMAL(14,3),
    "diferencia" DECIMAL(14,3),
    "estado" TEXT NOT NULL DEFAULT 'POR_RECIBIR',
    "pedido_interno_id" BIGINT,
    "enviado_por" BIGINT,
    "enviado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibido_por" BIGINT,
    "recibido_en" TIMESTAMPTZ,
    "nota" TEXT,

    CONSTRAINT "traslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_interno" (
    "id" BIGSERIAL NOT NULL,
    "area_id" BIGINT NOT NULL,
    "detalle" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avisado_party_id" BIGINT,
    "recibido_por" BIGINT,
    "recibido_en" TIMESTAMPTZ,
    "entregado_por" BIGINT,
    "entregado_en" TIMESTAMPTZ,

    CONSTRAINT "pedido_interno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produccion" (
    "id" BIGSERIAL NOT NULL,
    "receta_id" BIGINT NOT NULL,
    "tandas" DECIMAL(8,2) NOT NULL,
    "unidades" DECIMAL(14,3) NOT NULL,
    "producido_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "por" BIGINT NOT NULL,
    "anulado_en" TIMESTAMPTZ,
    "motivo_anulacion" TEXT,

    CONSTRAINT "produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_dia" (
    "id" BIGSERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "lugar_id" BIGINT NOT NULL,
    "detalle" JSONB NOT NULL,
    "por" BIGINT NOT NULL,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_personal" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumo_personal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativa" (
    "id" BIGSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "archivo_id" BIGINT,
    "estado" TEXT NOT NULL DEFAULT 'NUEVA',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" BIGINT NOT NULL,
    "estado_cambiado_en" TIMESTAMPTZ,
    "estado_cambiado_por" BIGINT,

    CONSTRAINT "iniciativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iniciativa_comentario" (
    "id" BIGSERIAL NOT NULL,
    "iniciativa_id" BIGINT NOT NULL,
    "texto" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" BIGINT NOT NULL,

    CONSTRAINT "iniciativa_comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversacion" (
    "id" BIGSERIAL NOT NULL,
    "telefono" TEXT NOT NULL,
    "party_id" BIGINT,
    "duenio" TEXT NOT NULL DEFAULT 'BOT',
    "tomado_por" BIGINT,
    "tomado_en" TIMESTAMPTZ,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "flujo" JSONB,
    "ultima_actividad" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensaje_chat" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "direccion" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "meta_id" TEXT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuesta_rapida" (
    "id" BIGSERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "respuesta_rapida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_reserva" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT,
    "personas" INTEGER,
    "hora" TIMESTAMPTZ,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "reserva_id" BIGINT,

    CONSTRAINT "solicitud_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_cambio" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "decidido_por" BIGINT,
    "motivo" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encuesta" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "nota" SMALLINT,
    "comentario" TEXT,
    "derivada" BOOLEAN NOT NULL DEFAULT false,
    "enviada_en" TIMESTAMPTZ,
    "respondida_en" TIMESTAMPTZ,

    CONSTRAINT "encuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "rol_destino" TEXT,
    "party_destino" BIGINT,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT,
    "enlace" TEXT,
    "leida_en" TIMESTAMPTZ,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_carta" (
    "id" BIGSERIAL NOT NULL,
    "estado" TEXT NOT NULL,
    "organizacion" TEXT NOT NULL DEFAULT 'SECCIONES',
    "decoracion" TEXT,
    "contenido" JSONB NOT NULL,
    "publicada_en" TIMESTAMPTZ,
    "publicada_por" BIGINT,

    CONSTRAINT "version_carta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedad" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT,
    "tema" TEXT,
    "video_url" TEXT,
    "evento_fecha" TIMESTAMPTZ,
    "evento_lugar" TEXT,
    "desde" DATE,
    "hasta" DATE,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedad_foto" (
    "novedad_id" BIGINT NOT NULL,
    "archivo_id" BIGINT NOT NULL,
    "orden" INTEGER DEFAULT 0,

    CONSTRAINT "novedad_foto_pkey" PRIMARY KEY ("novedad_id","archivo_id")
);

-- CreateTable
CREATE TABLE "destacada" (
    "id" BIGSERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "portada_archivo_id" BIGINT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destacada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destacada_foto" (
    "destacada_id" BIGINT NOT NULL,
    "archivo_id" BIGINT NOT NULL,
    "orden" INTEGER DEFAULT 0,

    CONSTRAINT "destacada_foto_pkey" PRIMARY KEY ("destacada_id","archivo_id")
);

-- CreateTable
CREATE TABLE "ranking_mes" (
    "anio_mes" CHAR(7) NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "puesto" SMALLINT,

    CONSTRAINT "ranking_mes_pkey" PRIMARY KEY ("anio_mes","producto_id")
);

-- CreateTable
CREATE TABLE "mensaje_carta" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "nombre" TEXT,
    "contacto" TEXT,
    "atendido_en" TIMESTAMPTZ,
    "atendido_por" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_carta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_key" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "llave_hash" TEXT NOT NULL,
    "area_id" BIGINT,
    "codigo_vinculo" TEXT,
    "codigo_expira_en" TIMESTAMPTZ,
    "ultima_conexion" TIMESTAMPTZ,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_job" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "area_id" BIGINT,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "impresora" TEXT,
    "error" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impreso_en" TIMESTAMPTZ,

    CONSTRAINT "print_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_request" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uso_externo" (
    "id" BIGSERIAL NOT NULL,
    "servicio" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "costo_usd" DECIMAL(10,4),
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_externo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compra_proveedor_party_id_comprobante_tipo_comprobante_nume_key" ON "compra"("proveedor_party_id", "comprobante_tipo", "comprobante_numero");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_dia_fecha_lugar_id_key" ON "cierre_dia"("fecha", "lugar_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_personal_pedido_id_key" ON "consumo_personal"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "iniciativa_codigo_key" ON "iniciativa"("codigo");

-- CreateIndex
CREATE INDEX "iniciativa_estado_creado_en_idx" ON "iniciativa"("estado", "creado_en" DESC);

-- CreateIndex
CREATE INDEX "iniciativa_comentario_iniciativa_id_creado_en_idx" ON "iniciativa_comentario"("iniciativa_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "conversacion_telefono_key" ON "conversacion"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "mensaje_chat_meta_id_key" ON "mensaje_chat"("meta_id");

-- CreateIndex
CREATE UNIQUE INDEX "respuesta_rapida_titulo_key" ON "respuesta_rapida"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "encuesta_pedido_id_key" ON "encuesta"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_key_llave_hash_key" ON "device_key"("llave_hash");

-- CreateIndex
CREATE UNIQUE INDEX "device_key_codigo_vinculo_key" ON "device_key"("codigo_vinculo");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_detail" ADD CONSTRAINT "supplier_detail_party_role_id_fkey" FOREIGN KEY ("party_role_id") REFERENCES "party_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_detail" ADD CONSTRAINT "employee_detail_party_role_id_fkey" FOREIGN KEY ("party_role_id") REFERENCES "party_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_trabajo" ADD CONSTRAINT "horario_trabajo_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_turno" ADD CONSTRAINT "cobertura_turno_cubre_party_id_fkey" FOREIGN KEY ("cubre_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobertura_turno" ADD CONSTRAINT "cobertura_turno_reemplaza_party_id_fkey" FOREIGN KEY ("reemplaza_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_proveedor" ADD CONSTRAINT "pedido_proveedor_proveedor_party_id_fkey" FOREIGN KEY ("proveedor_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_proveedor_linea" ADD CONSTRAINT "pedido_proveedor_linea_pedido_proveedor_id_fkey" FOREIGN KEY ("pedido_proveedor_id") REFERENCES "pedido_proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_proveedor_linea" ADD CONSTRAINT "pedido_proveedor_linea_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_proveedor_party_id_fkey" FOREIGN KEY ("proveedor_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_pedido_proveedor_id_fkey" FOREIGN KEY ("pedido_proveedor_id") REFERENCES "pedido_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_linea" ADD CONSTRAINT "compra_linea_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_linea" ADD CONSTRAINT "compra_linea_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_destino_lugar_id_fkey" FOREIGN KEY ("destino_lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_pedido_interno_id_fkey" FOREIGN KEY ("pedido_interno_id") REFERENCES "pedido_interno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_interno" ADD CONSTRAINT "pedido_interno_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_interno" ADD CONSTRAINT "pedido_interno_avisado_party_id_fkey" FOREIGN KEY ("avisado_party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produccion" ADD CONSTRAINT "produccion_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "receta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_dia" ADD CONSTRAINT "cierre_dia_lugar_id_fkey" FOREIGN KEY ("lugar_id") REFERENCES "lugar_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_personal" ADD CONSTRAINT "consumo_personal_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_personal" ADD CONSTRAINT "consumo_personal_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativa" ADD CONSTRAINT "iniciativa_estado_cambiado_por_fkey" FOREIGN KEY ("estado_cambiado_por") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativa_comentario" ADD CONSTRAINT "iniciativa_comentario_iniciativa_id_fkey" FOREIGN KEY ("iniciativa_id") REFERENCES "iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iniciativa_comentario" ADD CONSTRAINT "iniciativa_comentario_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_tomado_por_fkey" FOREIGN KEY ("tomado_por") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_chat" ADD CONSTRAINT "mensaje_chat_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_reserva" ADD CONSTRAINT "solicitud_reserva_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_reserva" ADD CONSTRAINT "solicitud_reserva_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_cambio" ADD CONSTRAINT "solicitud_cambio_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encuesta" ADD CONSTRAINT "encuesta_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_rol_destino_fkey" FOREIGN KEY ("rol_destino") REFERENCES "rol"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_party_destino_fkey" FOREIGN KEY ("party_destino") REFERENCES "party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_foto" ADD CONSTRAINT "novedad_foto_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "novedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedad_foto" ADD CONSTRAINT "novedad_foto_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destacada" ADD CONSTRAINT "destacada_portada_archivo_id_fkey" FOREIGN KEY ("portada_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destacada_foto" ADD CONSTRAINT "destacada_foto_destacada_id_fkey" FOREIGN KEY ("destacada_id") REFERENCES "destacada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destacada_foto" ADD CONSTRAINT "destacada_foto_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_mes" ADD CONSTRAINT "ranking_mes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_key" ADD CONSTRAINT "device_key_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
