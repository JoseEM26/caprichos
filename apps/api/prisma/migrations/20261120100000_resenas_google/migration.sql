-- Reseñas de Google Maps para la carta virtual (solo se inserta o actualiza desde la API externa;
-- el campo visible lo decide el administrador y una actualización nunca lo cambia).
CREATE TABLE "resena_google" (
    "id" BIGSERIAL NOT NULL,
    "google_review_id" TEXT NOT NULL,
    "autor_nombre" TEXT NOT NULL,
    "autor_foto_url" TEXT,
    "autor_enlace" TEXT,
    "calificacion" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "idioma" TEXT,
    "publicada_en" TIMESTAMPTZ,
    "enlace_resena" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "resena_google_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resena_google_google_review_id_key" ON "resena_google"("google_review_id");
