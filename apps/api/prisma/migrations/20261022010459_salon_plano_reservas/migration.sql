-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hash" SET DEFAULT '\x'::bytea;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "entregado_mesa_en" TIMESTAMPTZ,
ADD COLUMN     "mesa_nombre" TEXT;

-- CreateTable
CREATE TABLE "piso" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "cuadricula_ancho" INTEGER NOT NULL,
    "cuadricula_alto" INTEGER NOT NULL,

    CONSTRAINT "piso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elemento_plano" (
    "id" BIGSERIAL NOT NULL,
    "piso_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "ancho" INTEGER NOT NULL,
    "alto" INTEGER NOT NULL,
    "numero" INTEGER,
    "asientos" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "elemento_plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,
    "hora" TIMESTAMPTZ NOT NULL,
    "tolerancia_min" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "motivo_cancelacion" TEXT,
    "pedido_id" BIGINT,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_mesa" (
    "id" BIGSERIAL NOT NULL,
    "reserva_id" BIGINT NOT NULL,
    "mesa_id" BIGINT,

    CONSTRAINT "reserva_mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_mesa" (
    "id" BIGSERIAL NOT NULL,
    "pedido_id" BIGINT NOT NULL,
    "mesa_id" BIGINT,
    "mesa_nombre" TEXT,
    "abierta" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pedido_mesa_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "elemento_plano" ADD CONSTRAINT "elemento_plano_piso_id_fkey" FOREIGN KEY ("piso_id") REFERENCES "piso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_mesa" ADD CONSTRAINT "reserva_mesa_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_mesa" ADD CONSTRAINT "reserva_mesa_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "elemento_plano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mesa" ADD CONSTRAINT "pedido_mesa_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_mesa" ADD CONSTRAINT "pedido_mesa_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "elemento_plano"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones CHECK e índice único para tabla "elemento_plano"
ALTER TABLE "elemento_plano"
    ADD CONSTRAINT "ck_elemento_plano_tipo" CHECK ("tipo" IN ('MESA','COCINA','BARRA','BANO','PARED','ENTRADA','OTRO','ESCALERA','CAJA'));

CREATE UNIQUE INDEX "ux_mesa_numero" ON "elemento_plano" ("numero") WHERE "tipo" = 'MESA';

-- Restricciones CHECK para tabla "reserva"
ALTER TABLE "reserva"
    ADD CONSTRAINT "ck_reserva_personas" CHECK ("personas" > 0),
    ADD CONSTRAINT "ck_reserva_estado" CHECK ("estado" IN ('ACTIVA','SENTADA','NO_ASISTIO','CANCELADA'));

-- Índice único condicional para un solo pedido abierto por mesa
CREATE UNIQUE INDEX "ux_mesa_un_pedido_abierto" ON "pedido_mesa" ("mesa_id") WHERE "abierta";

