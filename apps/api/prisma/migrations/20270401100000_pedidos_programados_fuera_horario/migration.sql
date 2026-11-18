-- Pedidos programados por el cliente fuera de horario (carta web y bot de WhatsApp): interruptor apagado por defecto.
-- Encendido y con el local cerrado, el cliente puede enviar un pedido PARA LLEVAR o DELIVERY si lo programa para un día
-- y hora dentro del horario de atención. Sin parámetro o en «no» nada cambia. No pisa un valor ya puesto.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('pedidos_programados_fuera_horario', '"no"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
