-- Ofertas por tipo de pedido: comer en el local, llevar, recoger o delivery. Vacío = todos (nada cambia).
ALTER TABLE "oferta" ADD COLUMN IF NOT EXISTS "modalidades" TEXT[] NOT NULL DEFAULT '{}';
