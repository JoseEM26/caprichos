-- CONTROL DE ASISTENCIA DEL PERSONAL (aditiva e idempotente)
--
-- 1. horario_trabajo.almuerzo_inicio / almuerzo_fin: almuerzo programado por persona y día (opcional).
-- 2. asistencia_marca: marcas de entrada/almuerzo/salida. Append-only: las correcciones son filas nuevas
--    (origen = CORRECCION, con motivo y quién la hizo). Una marca CELULAR por persona, jornada y tipo.
-- 3. asistencia_selfie: foto de cada marca, privada (solo ADMIN la lee). Se borra por retención; la marca queda.
-- 4. asistencia_dispositivo: un celular por trabajador (huella = hash de un identificador del navegador).
-- 5. asistencia_consentimiento: aviso de tratamiento de datos personales (Ley 29733) aceptado y con fecha.
-- Parámetros (tolerancia, radio, retención, coordenadas) viven en parametro: clave asistencia.config.
--
-- Sin datos que migrar. Idempotente: IF NOT EXISTS en todo; las restricciones se crean solo si faltan.

ALTER TABLE "horario_trabajo" ADD COLUMN IF NOT EXISTS "almuerzo_inicio" TIME;
ALTER TABLE "horario_trabajo" ADD COLUMN IF NOT EXISTS "almuerzo_fin" TIME;

CREATE TABLE IF NOT EXISTS "asistencia_marca" (
    "id" BIGSERIAL NOT NULL,
    "party_id" BIGINT NOT NULL,
    "jornada" DATE NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "origen" VARCHAR(12) NOT NULL DEFAULT 'CELULAR',
    "momento" TIMESTAMPTZ NOT NULL,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'VALIDA',
    "motivos_revision" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "precision_m" DECIMAL(8,2),
    "distancia_m" DECIMAL(8,2),
    "qr_slot" BIGINT,
    "dispositivo_hash" VARCHAR(64),
    "motivo" TEXT,
    "por_party_id" BIGINT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_marca_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asistencia_marca_tipo_check" CHECK ("tipo" IN ('ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA')),
    CONSTRAINT "asistencia_marca_origen_check" CHECK ("origen" IN ('CELULAR', 'CORRECCION')),
    CONSTRAINT "asistencia_marca_estado_check" CHECK ("estado" IN ('VALIDA', 'A_REVISAR')),
    CONSTRAINT "asistencia_marca_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "asistencia_marca_por_party_id_fkey" FOREIGN KEY ("por_party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "asistencia_marca_party_id_qr_slot_key" ON "asistencia_marca" ("party_id", "qr_slot");
CREATE INDEX IF NOT EXISTS "asistencia_marca_party_id_jornada_idx" ON "asistencia_marca" ("party_id", "jornada");
CREATE UNIQUE INDEX IF NOT EXISTS "asistencia_marca_celular_unica" ON "asistencia_marca" ("party_id", "jornada", "tipo") WHERE "origen" = 'CELULAR';

CREATE TABLE IF NOT EXISTS "asistencia_selfie" (
    "marca_id" BIGINT NOT NULL,
    "contenido" BYTEA NOT NULL,
    "mime" VARCHAR(30) NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asistencia_selfie_pkey" PRIMARY KEY ("marca_id"),
    CONSTRAINT "asistencia_selfie_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "asistencia_marca"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "asistencia_dispositivo" (
    "party_id" BIGINT NOT NULL,
    "huella_hash" VARCHAR(64) NOT NULL,
    "vinculado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_en" TIMESTAMPTZ,
    CONSTRAINT "asistencia_dispositivo_pkey" PRIMARY KEY ("party_id"),
    CONSTRAINT "asistencia_dispositivo_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "asistencia_consentimiento" (
    "party_id" BIGINT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "aceptado_en" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "asistencia_consentimiento_pkey" PRIMARY KEY ("party_id"),
    CONSTRAINT "asistencia_consentimiento_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
