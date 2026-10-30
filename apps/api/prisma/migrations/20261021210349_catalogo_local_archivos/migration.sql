-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- CreateTable
CREATE TABLE "lista" (
    "id" BIGSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "lista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_valor" (
    "id" BIGSERIAL NOT NULL,
    "lista_id" BIGINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lista_valor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_dia" (
    "dia_semana" SMALLINT NOT NULL,
    "abre" TIME,
    "cierra" TIME,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "horario_dia_pkey" PRIMARY KEY ("dia_semana")
);

-- CreateTable
CREATE TABLE "fecha_especial" (
    "fecha" DATE NOT NULL,
    "cerrado" BOOLEAN NOT NULL,
    "abre" TIME,
    "cierra" TIME,
    "motivo" TEXT,

    CONSTRAINT "fecha_especial_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "archivo" (
    "id" BIGSERIAL NOT NULL,
    "ruta" TEXT NOT NULL,
    "tipo_mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "privado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foto_local" (
    "archivo_id" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "foto_local_pkey" PRIMARY KEY ("archivo_id")
);

-- CreateTable
CREATE TABLE "area_cocina" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "propia" BOOLEAN NOT NULL DEFAULT false,
    "impresora" TEXT,
    "etiquetera" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "area_cocina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "lleva_opciones" BOOLEAN NOT NULL DEFAULT true,
    "area_id" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "oculta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" BIGSERIAL NOT NULL,
    "categoria_id" BIGINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "foto_archivo_id" BIGINT,
    "precio" DECIMAL(12,2) NOT NULL,
    "por_lote" BOOLEAN NOT NULL DEFAULT false,
    "vida_util_horas" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "oculto" BOOLEAN NOT NULL DEFAULT false,
    "agotado_hasta" TIMESTAMPTZ,
    "no_suma_beneficios" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_tamano" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "tamano_valor_id" BIGINT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "producto_tamano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_opciones" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "lista_id" BIGINT,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "minimo" INTEGER NOT NULL DEFAULT 0,
    "maximo" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grupo_opciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcion" (
    "id" BIGSERIAL NOT NULL,
    "grupo_id" BIGINT NOT NULL,
    "valor_id" BIGINT NOT NULL,
    "precio_extra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "agotado_hasta" TIMESTAMPTZ,

    CONSTRAINT "opcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_grupo" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "grupo_id" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "producto_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sabor" (
    "id" BIGSERIAL NOT NULL,
    "producto_id" BIGINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "agotado_hasta" TIMESTAMPTZ,

    CONSTRAINT "sabor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lista_codigo_key" ON "lista"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "lista_valor_lista_id_nombre_key" ON "lista_valor"("lista_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "archivo_ruta_key" ON "archivo"("ruta");

-- CreateIndex
CREATE UNIQUE INDEX "area_cocina_nombre_key" ON "area_cocina"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_nombre_key" ON "producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_tamano_producto_id_tamano_valor_id_key" ON "producto_tamano"("producto_id", "tamano_valor_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_opciones_nombre_key" ON "grupo_opciones"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "opcion_grupo_id_valor_id_key" ON "opcion"("grupo_id", "valor_id");

-- CreateIndex
CREATE UNIQUE INDEX "producto_grupo_producto_id_grupo_id_key" ON "producto_grupo"("producto_id", "grupo_id");

-- CreateIndex
CREATE UNIQUE INDEX "sabor_producto_id_nombre_key" ON "sabor"("producto_id", "nombre");

-- AddForeignKey
ALTER TABLE "lista_valor" ADD CONSTRAINT "lista_valor_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "lista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto_local" ADD CONSTRAINT "foto_local_archivo_id_fkey" FOREIGN KEY ("archivo_id") REFERENCES "archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area_cocina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_foto_archivo_id_fkey" FOREIGN KEY ("foto_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_tamano" ADD CONSTRAINT "producto_tamano_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_tamano" ADD CONSTRAINT "producto_tamano_tamano_valor_id_fkey" FOREIGN KEY ("tamano_valor_id") REFERENCES "lista_valor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_opciones" ADD CONSTRAINT "grupo_opciones_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "lista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion" ADD CONSTRAINT "opcion_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_opciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcion" ADD CONSTRAINT "opcion_valor_id_fkey" FOREIGN KEY ("valor_id") REFERENCES "lista_valor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_grupo" ADD CONSTRAINT "producto_grupo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_grupo" ADD CONSTRAINT "producto_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_opciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sabor" ADD CONSTRAINT "sabor_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa (DDL de referencia DAT-CAP-001)
ALTER TABLE "horario_dia" ADD CONSTRAINT ck_horario_dia_dia_semana CHECK (dia_semana BETWEEN 1 AND 7);
ALTER TABLE "archivo" ADD CONSTRAINT ck_archivo_bytes CHECK (bytes <= 5242880);
ALTER TABLE "producto" ADD CONSTRAINT ck_producto_precio CHECK (precio >= 0);
ALTER TABLE "producto_tamano" ADD CONSTRAINT ck_producto_tamano_precio CHECK (precio >= 0);
ALTER TABLE "grupo_opciones" ADD CONSTRAINT ck_grupo_opciones_maximo CHECK (maximo >= minimo AND minimo >= 0);
ALTER TABLE "opcion" ADD CONSTRAINT ck_opcion_precio_extra CHECK (precio_extra >= 0);

