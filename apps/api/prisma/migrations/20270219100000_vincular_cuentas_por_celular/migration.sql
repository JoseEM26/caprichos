-- Vincula las cuentas de cliente que ya coinciden por celular con el usuario del panel de la misma persona
-- (customer_account.usuario_party_id, el mismo vínculo de la sección «Cuenta de cliente»). Idempotente y sin efectos
-- colaterales: no mueve pedidos, puntos ni créditos, no borra nada, no toca contraseñas ni permisos.
--
-- Regla: cuenta ACTIVA con celular (9 dígitos) y sin vínculo, cuyo party NO es un usuario del panel, cuyo celular coincide
-- (últimos 9 dígitos, con o sin 51, espacios, guiones o +) con un contacto TELEFONO/WHATSAPP activo de un usuario ACTIVO de
-- OTRO party que aún no tiene cuenta vinculada. Si hay varias, gana la cuenta de menor id por usuario (y el usuario de menor
-- party por cuenta): nunca más de una cuenta por usuario, así que el índice único parcial no falla.
WITH pares AS (
  SELECT c."id" AS cuenta_id, c."party_id" AS cuenta_party_id, u."party_id" AS usuario_party_id, u."id" AS usuario_id
  FROM "customer_account" c
  JOIN "contact_mechanism" k
    ON k."tipo" IN ('TELEFONO', 'WHATSAPP') AND k."activo"
   AND length(regexp_replace(k."valor", '\D', '', 'g')) >= 9
   AND right(regexp_replace(k."valor", '\D', '', 'g'), 9) = c."telefono"
  JOIN "user_account" u ON u."party_id" = k."party_id" AND u."activo"
  WHERE c."activo" AND c."usuario_party_id" IS NULL AND c."telefono" IS NOT NULL
    AND c."party_id" <> u."party_id"
    AND NOT EXISTS (SELECT 1 FROM "user_account" ux WHERE ux."party_id" = c."party_id")
    AND NOT EXISTS (SELECT 1 FROM "customer_account" v WHERE v."usuario_party_id" = u."party_id")
),
por_cuenta AS (
  SELECT DISTINCT ON (cuenta_id) * FROM pares ORDER BY cuenta_id, usuario_party_id
),
elegidos AS (
  SELECT DISTINCT ON (usuario_party_id) * FROM por_cuenta ORDER BY usuario_party_id, cuenta_id
),
vinculadas AS (
  UPDATE "customer_account" c
  SET "usuario_party_id" = e.usuario_party_id
  FROM elegidos e
  WHERE c."id" = e.cuenta_id AND c."usuario_party_id" IS NULL
  RETURNING c."id" AS cuenta_id, e.usuario_id, e.usuario_party_id, e.cuenta_party_id
)
INSERT INTO "auditoria" ("categoria", "modulo", "accion", "entidad", "entidad_id", "despues", "motivo")
SELECT 'CAMBIO', 'usuarios', 'USUARIO_VINCULAR_CUENTA_CLIENTE', 'customer_account', v.cuenta_id,
       jsonb_build_object('usuarioId', v.usuario_id::text, 'usuarioPartyId', v.usuario_party_id::text,
                          'cuentaPartyId', v.cuenta_party_id::text, 'origen', 'MIGRACION_CELULAR'),
       'Vinculación automática por celular coincidente (migración)'
FROM vinculadas v;
