-- Decisión del dueño (29/10/2026): «Shots de espresso extra» y «Extras (opcional)» casi nadie los pide y alargan
-- el pedido; dejan de mostrarse en la carta, el bot y el mozo. Se desactivan (no se borran) y se pueden reactivar
-- desde Productos > Grupos de opciones.
UPDATE "grupo_opciones" SET "activo" = false WHERE "nombre" IN ('Shots de espresso extra', 'Extras (opcional)');
