-- Lectura de notificaciones por persona: cada usuario marca lo suyo sin afectar a los demás.
-- leida_en NULL = marcada como no leída de forma explícita (pisa el leida_en heredado de "notificacion").
CREATE TABLE "notificacion_lectura" (
    "party_id" BIGINT NOT NULL,
    "clave" TEXT NOT NULL,
    "leida_en" TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT "notificacion_lectura_pkey" PRIMARY KEY ("party_id", "clave")
);

CREATE INDEX "notificacion_lectura_party_id_leida_en_idx" ON "notificacion_lectura"("party_id", "leida_en");
