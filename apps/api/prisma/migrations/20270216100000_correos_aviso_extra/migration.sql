-- Correos de aviso extra (sin usuario) y marcas de idempotencia de avisos programados. Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS "correo_aviso_extra" (
  "id" BIGSERIAL PRIMARY KEY,
  "correo" VARCHAR(160) NOT NULL,
  "etiqueta" VARCHAR(60),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "tipos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "creado_por" BIGINT,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "correo_aviso_extra_correo_key" ON "correo_aviso_extra"("correo");

CREATE TABLE IF NOT EXISTS "aviso_marca" (
  "id" BIGSERIAL PRIMARY KEY,
  "clave" VARCHAR(160) NOT NULL,
  "tipo" VARCHAR(30) NOT NULL,
  "referencia" VARCHAR(160),
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "aviso_marca_clave_key" ON "aviso_marca"("clave");
CREATE INDEX IF NOT EXISTS "aviso_marca_tipo_creado_en_idx" ON "aviso_marca"("tipo", "creado_en");

-- Aviso «chat sin responder»: solo las conversaciones que esperan a una persona (casi vacío), sin recorrer todos los chats.
CREATE INDEX IF NOT EXISTS "conversacion_espera_humana_idx" ON "conversacion"("ultima_actividad")
  WHERE "urgente" OR "estado" = 'VALIDAR_PAGO';
