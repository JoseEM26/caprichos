-- Anuncios emergentes («novedades al ingresar»): modal programable para la carta y el personal. Aditiva.
CREATE TABLE "anuncio" (
  "id" BIGSERIAL PRIMARY KEY,
  "publico" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "plantilla" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "texto" TEXT,
  "imagen_url" TEXT,
  "boton_texto" TEXT,
  "boton_enlace" TEXT,
  "detalle" JSONB,
  "color" TEXT NOT NULL DEFAULT 'CREMA',
  "desde" TIMESTAMPTZ,
  "hasta" TIMESTAMPTZ,
  "franja_desde" TEXT,
  "franja_hasta" TEXT,
  "dias_semana" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "frecuencia" TEXT NOT NULL DEFAULT 'UNA_VEZ',
  "veces_por_dia" INTEGER NOT NULL DEFAULT 1,
  "cada_horas" INTEGER,
  "cierre_segundos" INTEGER NOT NULL DEFAULT 0,
  "puede_cerrar" BOOLEAN NOT NULL DEFAULT true,
  "prioridad" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creado_por" BIGINT,
  "actualizado_por" BIGINT,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ck_anuncio_publico" CHECK ("publico" IN ('CARTA','PERSONAL','AMBOS')),
  CONSTRAINT "ck_anuncio_frecuencia" CHECK ("frecuencia" IN ('UNA_VEZ','CADA_INGRESO','VECES_POR_DIA','CADA_N_HORAS')),
  CONSTRAINT "ck_anuncio_cierre" CHECK ("cierre_segundos" >= 0 AND "veces_por_dia" >= 1)
);
CREATE INDEX "anuncio_activo_publico_idx" ON "anuncio" ("activo", "publico");

CREATE TABLE "anuncio_vista" (
  "id" BIGSERIAL PRIMARY KEY,
  "anuncio_id" BIGINT NOT NULL REFERENCES "anuncio"("id") ON DELETE CASCADE,
  "tipo" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "party_id" BIGINT,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ck_anuncio_vista_tipo" CHECK ("tipo" IN ('VISTA','CIERRE','CLIC','ENTENDIDO'))
);
CREATE INDEX "anuncio_vista_anuncio_id_tipo_idx" ON "anuncio_vista" ("anuncio_id", "tipo");
CREATE INDEX "anuncio_vista_party_id_anuncio_id_creado_en_idx" ON "anuncio_vista" ("party_id", "anuncio_id", "creado_en");

-- Permisos del módulo (el sincronizador también los crea al arrancar); ADMIN y MARKETING los reciben.
INSERT INTO "permiso" ("modulo", "accion")
VALUES ('anuncios', 'ver'), ('anuncios', 'crear'), ('anuncios', 'editar'), ('anuncios', 'eliminar')
ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "permiso" p
JOIN "rol" r ON r."codigo" IN ('ADMIN', 'MARKETING')
WHERE p."modulo" = 'anuncios'
ON CONFLICT ("rol", "permiso_id") DO NOTHING;
