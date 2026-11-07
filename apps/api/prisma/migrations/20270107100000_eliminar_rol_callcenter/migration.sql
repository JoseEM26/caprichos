-- ELIMINAR EL ROL CALLCENTER (decisión del dueño). Idempotente y segura con 0 usuarios.
-- 1. MOZO, CAJERO y SUPERVISOR reciben el chat de WhatsApp (mensajes/* y whatsapp_salientes/*).
-- 2. Quien tenga CALLCENTER como rol principal: pasa a su primer rol extra permanente (si lo tiene) o a MOZO.
--    Nunca queda sin rol. Quien lo tenga como rol extra: solo se le retira.
-- 3. Se borran sus permisos, las asignaciones y, si el historial inmutable de roles no lo referencia, la fila del rol.
--    Si lo referencia (FK), la fila queda sin permisos ni usuarios y el historial queda intacto.
-- Constancia: una fila de auditoría por usuario.

-- MOZO es el destino por defecto: se asegura que exista (en bases con seed ya está)
INSERT INTO "rol" ("codigo", "nombre") VALUES ('MOZO', 'Mozo') ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "permiso" ("modulo", "accion") VALUES
  ('mensajes', 'ver'), ('mensajes', 'tomar'), ('mensajes', 'enviar'), ('mensajes', 'cerrar'),
  ('whatsapp_salientes', 'ver'), ('whatsapp_salientes', 'reenviar'), ('whatsapp_salientes', 'descartar')
ON CONFLICT ("modulo", "accion") DO NOTHING;

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT r."codigo", p."id"
FROM "rol" r
JOIN "permiso" p ON (p."modulo" = 'mensajes' AND p."accion" IN ('ver', 'tomar', 'enviar', 'cerrar'))
                 OR (p."modulo" = 'whatsapp_salientes' AND p."accion" IN ('ver', 'reenviar', 'descartar'))
WHERE r."codigo" IN ('MOZO', 'CAJERO', 'SUPERVISOR')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  u RECORD;
  nuevo TEXT;
  n_principal INT := 0;
  n_extra INT := 0;
BEGIN
  -- Rol principal CALLCENTER
  FOR u IN SELECT "id" FROM "user_account" WHERE "rol" = 'CALLCENTER' ORDER BY "id" LOOP
    SELECT e."rol" INTO nuevo
    FROM "user_account_rol" e
    WHERE e."user_account_id" = u."id" AND e."vence_en" IS NULL AND e."rol" <> 'CALLCENTER'
    ORDER BY e."otorgado_en", e."rol" LIMIT 1;
    IF nuevo IS NULL THEN nuevo := 'MOZO'; END IF;
    -- el nuevo principal deja de ser extra (un rol no se repite)
    DELETE FROM "user_account_rol" WHERE "user_account_id" = u."id" AND "rol" = nuevo;
    UPDATE "user_account" SET "rol" = nuevo WHERE "id" = u."id";
    INSERT INTO "auditoria" ("categoria", "modulo", "accion", "entidad", "entidad_id", "antes", "despues", "motivo")
    VALUES ('CAMBIO', 'usuarios', 'cambio_rol_automatico', 'user_account', u."id",
            jsonb_build_object('rol', 'CALLCENTER'), jsonb_build_object('rol', nuevo),
            'Cambio de rol automático: CALLCENTER → ' || nuevo || ' (rol eliminado)');
    n_principal := n_principal + 1;
  END LOOP;

  -- Rol extra CALLCENTER (el principal ya es otro)
  FOR u IN SELECT "user_account_id" AS "id" FROM "user_account_rol" WHERE "rol" = 'CALLCENTER' ORDER BY 1 LOOP
    DELETE FROM "user_account_rol" WHERE "user_account_id" = u."id" AND "rol" = 'CALLCENTER';
    INSERT INTO "auditoria" ("categoria", "modulo", "accion", "entidad", "entidad_id", "antes", "despues", "motivo")
    VALUES ('CAMBIO', 'usuarios', 'retiro_rol_automatico', 'user_account', u."id",
            jsonb_build_object('rol_extra', 'CALLCENTER'), NULL,
            'Rol extra CALLCENTER retirado (rol eliminado)');
    n_extra := n_extra + 1;
  END LOOP;

  -- Avisos dirigidos al rol: pasan a MOZO (un rol_destino nulo significaría «todos»)
  UPDATE "notificacion" SET "rol_destino" = 'MOZO' WHERE "rol_destino" = 'CALLCENTER';

  DELETE FROM "rol_permiso" WHERE "rol" = 'CALLCENTER';

  -- El historial de roles es inmutable y referencia el rol por FK: si lo usa, la fila se queda (sin permisos ni usuarios)
  DELETE FROM "rol" r
  WHERE r."codigo" = 'CALLCENTER'
    AND NOT EXISTS (SELECT 1 FROM "user_account_rol_historial" h WHERE h."rol" = r."codigo")
    AND NOT EXISTS (SELECT 1 FROM "user_account" a WHERE a."rol" = r."codigo")
    AND NOT EXISTS (SELECT 1 FROM "user_account_rol" e WHERE e."rol" = r."codigo");

  RAISE NOTICE 'Rol CALLCENTER eliminado: % usuarios con rol principal migrado, % con rol extra retirado.', n_principal, n_extra;
END
$$;
