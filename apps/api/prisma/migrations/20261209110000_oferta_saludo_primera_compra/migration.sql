-- Oferta: saludo del chat de WhatsApp y descuento solo para la primera compra del cliente (celular con sesión)
ALTER TABLE "oferta" ADD COLUMN "mostrar_en_saludo_bot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "oferta" ADD COLUMN "solo_primera_compra" BOOLEAN NOT NULL DEFAULT false;
