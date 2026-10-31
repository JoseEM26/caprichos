-- Una persona = un party: un celular activo (TELEFONO o WHATSAPP) pertenece a un solo party.
-- Índice único PARCIAL, creado SOLO si hoy no hay celulares duplicados. Si hay duplicados no se crea el índice
-- (no se borra ni se cambia ningún dato): se avisa con NOTICE y el dueño decide cómo unificarlos y, ya limpios,
-- crea el índice a mano con la sentencia CREATE UNIQUE INDEX de abajo (esta migración corre una sola vez). Así la migración
-- nunca falla por datos viejos.
-- Nota: cuenta también los duplicados del mismo party (TELEFONO y WHATSAPP con el mismo número), porque el índice
-- no distingue el party de la fila duplicada.
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados
  FROM (
    SELECT "valor"
    FROM "contact_mechanism"
    WHERE "tipo" IN ('TELEFONO', 'WHATSAPP') AND "activo" = true
    GROUP BY "valor"
    HAVING COUNT(*) > 1
  ) AS repetidos;

  IF duplicados > 0 THEN
    RAISE NOTICE 'contacto_telefono_unico: hay % celulares repetidos; no se crea el indice uq_contact_mechanism_telefono_activo', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_contact_mechanism_telefono_activo"
      ON "contact_mechanism" ("valor")
      WHERE "tipo" IN ('TELEFONO', 'WHATSAPP') AND "activo" = true;
  END IF;
END $$;
