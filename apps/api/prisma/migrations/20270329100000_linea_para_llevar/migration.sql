-- Para llevar por línea: en un pedido de mesa o de salón, algunos productos se empacan para llevar y el resto se come aquí.
-- Aditiva: las líneas ya existentes quedan en false (comer aquí), que es lo que hacían antes.
ALTER TABLE "pedido_linea" ADD COLUMN "para_llevar" BOOLEAN NOT NULL DEFAULT false;
