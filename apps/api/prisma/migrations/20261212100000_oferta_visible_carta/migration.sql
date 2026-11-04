-- Oferta: visible en la carta virtual (el diseñador la oculta sin apagar el descuento)
ALTER TABLE "oferta" ADD COLUMN IF NOT EXISTS "visible_carta" BOOLEAN NOT NULL DEFAULT true;
