-- Chats que llegan como LID / usuario de WhatsApp sin número: el celular vinculado (9 dígitos) los une con sus pedidos.
ALTER TABLE "conversacion" ADD COLUMN "celular_vinculado" VARCHAR(9);
CREATE INDEX "conversacion_celular_vinculado_idx" ON "conversacion"("celular_vinculado");
