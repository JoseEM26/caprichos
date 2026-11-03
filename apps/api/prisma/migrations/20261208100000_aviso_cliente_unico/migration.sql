-- Avisos que se mandan una sola vez por celular (p. ej. la bienvenida a los puntos). Solo se inserta. Idempotente.
CREATE TABLE IF NOT EXISTS "aviso_cliente_unico" (
    "telefono" VARCHAR(9) NOT NULL,
    "aviso" VARCHAR(40) NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "aviso_cliente_unico_pkey" PRIMARY KEY ("telefono", "aviso")
);
