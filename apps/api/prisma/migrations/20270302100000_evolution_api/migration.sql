-- WhatsApp con Evolution API (no oficial) como unico numero, con Meta como respaldo conmutable.
-- Meta sigue siendo el proveedor activo: nada cambia hasta que un ADMIN lo cambie en Configuracion.
-- Los limites anti-bloqueo salen con valores conservadores. Si alguna clave ya existia, no se toca.
INSERT INTO "parametro" ("clave", "valor") VALUES
  ('whatsapp_proveedor', '"META"'::jsonb),
  ('evolution_pausado', '"no"'::jsonb),
  ('evolution_limite_minuto', '3'::jsonb),
  ('evolution_limite_hora', '30'::jsonb),
  ('evolution_limite_dia', '150'::jsonb),
  ('evolution_pausa_min_seg', '2'::jsonb),
  ('evolution_pausa_max_seg', '6'::jsonb),
  ('evolution_escribiendo_ms_por_caracter', '40'::jsonb),
  ('evolution_horario_desde', '9'::jsonb),
  ('evolution_horario_hasta', '22'::jsonb),
  ('evolution_exigir_contacto_previo', '"si"'::jsonb),
  ('evolution_max_enlaces', '1'::jsonb),
  ('evolution_max_texto_identico', '2'::jsonb),
  ('evolution_origenes_permitidos', '"AVISO_PEDIDO,ENCUESTA,CODIGO_CUENTA,RESERVA,AVISO_CUENTA"'::jsonb)
ON CONFLICT ("clave") DO NOTHING;
