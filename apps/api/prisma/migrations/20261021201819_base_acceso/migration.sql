-- CreateTable
CREATE TABLE "sys_control" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party" (
    "id" BIGSERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "party_id" BIGINT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,

    CONSTRAINT "person_pkey" PRIMARY KEY ("party_id")
);

-- CreateTable
CREATE TABLE "party_identifier" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,

    CONSTRAINT "party_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "permiso" (
    "id" BIGSERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permiso" (
    "rol" TEXT NOT NULL,
    "permiso_id" BIGINT NOT NULL,

    CONSTRAINT "rol_permiso_pkey" PRIMARY KEY ("rol","permiso_id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "rol" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "debe_cambiar" BOOLEAN NOT NULL DEFAULT true,
    "pin_hash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "alta_en" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" BIGSERIAL NOT NULL,
    "audiencia" TEXT NOT NULL,
    "party_id" BIGINT NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "dispositivo" TEXT,
    "expira_en" TIMESTAMPTZ NOT NULL,
    "revocada_en" TIMESTAMPTZ,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,

    CONSTRAINT "parametro_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "resultado" TEXT NOT NULL DEFAULT 'OK',
    "entidad" TEXT,
    "entidad_id" BIGINT,
    "antes" JSONB,
    "despues" JSONB,
    "motivo" TEXT,
    "party_id" BIGINT,
    "con_pin_admin" BOOLEAN NOT NULL DEFAULT false,
    "ip" INET,
    "dispositivo" TEXT,
    "request_id" TEXT,
    "en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash_anterior" BYTEA,
    "hash" BYTEA NOT NULL DEFAULT '\x'::bytea,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_control_clave_key" ON "sys_control"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "party_identifier_tipo_numero_key" ON "party_identifier"("tipo", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_modulo_accion_key" ON "permiso"("modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_party_id_key" ON "user_account"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_refresh_hash_key" ON "sesion"("refresh_hash");

-- CreateIndex
CREATE INDEX "ix_auditoria_busqueda" ON "auditoria"("en" DESC, "modulo", "party_id");

-- CreateIndex
CREATE INDEX "ix_auditoria_entidad" ON "auditoria"("entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_identifier" ADD CONSTRAINT "party_identifier_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_rol_fkey" FOREIGN KEY ("rol") REFERENCES "rol"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permiso" ADD CONSTRAINT "rol_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_rol_fkey" FOREIGN KEY ("rol") REFERENCES "rol"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no expresa (DDL de referencia DAT-CAP-001)
ALTER TABLE "party" ADD CONSTRAINT ck_party_tipo CHECK (tipo IN ('PERSONA','ORGANIZACION'));
ALTER TABLE "party" ADD CONSTRAINT ck_party_estado CHECK (estado IN ('ACTIVO','ANONIMIZADO'));
ALTER TABLE "party_identifier" ADD CONSTRAINT ck_party_identifier CHECK (
  (tipo = 'DNI' AND numero ~ '^\d{8}$') OR (tipo = 'RUC' AND numero ~ '^\d{11}$') OR tipo = 'CE');
ALTER TABLE "rol" ADD CONSTRAINT ck_rol_codigo CHECK (
  codigo IN ('ADMIN','CAJERO','COCINA','MOZO','CALLCENTER','ALMACEN','REPARTIDOR'));
ALTER TABLE "sesion" ADD CONSTRAINT ck_sesion_audiencia CHECK (audiencia IN ('ADMIN','CARTA'));
ALTER TABLE "auditoria" ADD CONSTRAINT ck_auditoria_categoria CHECK (categoria IN ('CAMBIO','ACCESO','LECTURA_SENSIBLE'));
ALTER TABLE "auditoria" ADD CONSTRAINT ck_auditoria_resultado CHECK (resultado IN ('OK','RECHAZADO'));

-- Auditoría: huella encadenada (ADR-014)
CREATE FUNCTION auditoria_encadenar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev bytea;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auditoria'));
  SELECT hash INTO prev FROM auditoria ORDER BY id DESC LIMIT 1;
  NEW.hash_anterior := prev;
  NEW.hash := sha256(coalesce(prev, ''::bytea) || convert_to(
      concat_ws('|', NEW.categoria, NEW.modulo, NEW.accion, NEW.resultado, NEW.entidad, NEW.entidad_id,
                NEW.antes::text, NEW.despues::text, NEW.motivo, NEW.party_id, NEW.con_pin_admin, NEW.ip, NEW.en), 'UTF8'));
  RETURN NEW;
END $$;
CREATE TRIGGER tg_auditoria_encadenar BEFORE INSERT ON "auditoria" FOR EACH ROW EXECUTE FUNCTION auditoria_encadenar();

-- Nadie edita ni borra la auditoría, ni siquiera la aplicación
CREATE FUNCTION auditoria_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'La auditoría no se edita ni se borra'; END $$;
CREATE TRIGGER tg_auditoria_inmutable BEFORE UPDATE OR DELETE ON "auditoria" FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
