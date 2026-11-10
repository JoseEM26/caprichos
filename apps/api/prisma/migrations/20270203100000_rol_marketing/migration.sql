-- Rol extra MARKETING «Marketing y diseño» (apps/api/src/modulos/acceso/permisos.ts). Aditiva e idempotente: sirve en bases con datos y en vacías.
-- Los permisos del rol y los permisos nuevos (conocenos/*, paleta/*, resenas/*) los crea y vincula el sincronizador al arrancar (MATRIZ).
ALTER TABLE "rol" DROP CONSTRAINT IF EXISTS "ck_rol_codigo";
ALTER TABLE "rol" ADD CONSTRAINT "ck_rol_codigo" CHECK (
  "codigo" IN ('ADMIN','CAJERO','COCINA','MOZO','CALLCENTER','ALMACEN','REPARTIDOR','SUPERVISOR','APOYO_DELIVERY','MARKETING'));

INSERT INTO "rol" ("codigo", "nombre")
VALUES ('MARKETING', 'Marketing y diseño')
ON CONFLICT ("codigo") DO NOTHING;

-- Conócenos y Paleta tenían permisos prestados (novedades/*, carta_diseno/*, local/ver). Ahora tienen permisos propios:
-- quien ya los tenía por un ajuste del dueño (Qué ve cada rol) o por un permiso extra de la cuenta conserva el acceso.
INSERT INTO "rol_permiso_ajuste" ("rol", "modulo", "accion", "efecto")
SELECT a."rol", n."modulo", n."accion", 'CONCEDE'
FROM "rol_permiso_ajuste" a
JOIN (VALUES
  ('novedades', 'ver', 'conocenos', 'ver'),
  ('novedades', 'editar', 'conocenos', 'editar'),
  ('novedades', 'editar', 'conocenos', 'publicar'),
  ('carta_diseno', 'ver', 'paleta', 'ver'),
  ('local', 'ver', 'paleta', 'ver'),
  ('carta_diseno', 'editar', 'paleta', 'editar'),
  ('carta_diseno', 'publicar', 'paleta', 'publicar')
) AS n("origen_modulo", "origen_accion", "modulo", "accion")
  ON a."modulo" = n."origen_modulo" AND a."accion" = n."origen_accion"
WHERE a."efecto" = 'CONCEDE' AND a."rol" <> 'ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO "user_account_permiso" ("user_account_id", "modulo", "accion", "otorgado_por", "otorgado_en", "vence_en", "nota")
SELECT u."user_account_id", n."modulo", n."accion", u."otorgado_por", u."otorgado_en", u."vence_en", u."nota"
FROM "user_account_permiso" u
JOIN (VALUES
  ('novedades', 'ver', 'conocenos', 'ver'),
  ('novedades', 'editar', 'conocenos', 'editar'),
  ('novedades', 'editar', 'conocenos', 'publicar'),
  ('carta_diseno', 'ver', 'paleta', 'ver'),
  ('carta_diseno', 'editar', 'paleta', 'editar'),
  ('carta_diseno', 'publicar', 'paleta', 'publicar')
) AS n("origen_modulo", "origen_accion", "modulo", "accion")
  ON u."modulo" = n."origen_modulo" AND u."accion" = n."origen_accion"
ON CONFLICT DO NOTHING;
