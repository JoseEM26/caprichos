-- Matriz de permisos del CAJERO (apps/api/src/modulos/acceso/permisos.ts). Solo caja, pedidos sin anular,
-- cocina y carta en lectura. Quita lo que ya no le corresponde e inserta lo que falta.
DELETE FROM "rol_permiso" rp
USING "permiso" p
WHERE rp."permiso_id" = p."id"
  AND rp."rol" = 'CAJERO'
  AND (p."modulo" || '/' || p."accion") NOT IN (
    'pedidos/ver',
    'pedidos/cambiar_estado',
    'caja/abrir',
    'caja/cobrar',
    'caja/movimientos',
    'caja/cerrar',
    'caja/ver',
    'cocina/ver',
    'catalogo/ver',
    'comprobantes/ver',
    'comprobantes/reimprimir',
    'mesas/ver',
    'mesas/liberar',
    'repartos/ver',
    'repartos/liquidar'
  );

INSERT INTO "rol_permiso" ("rol", "permiso_id")
SELECT 'CAJERO', p."id"
FROM "permiso" p
WHERE (p."modulo" || '/' || p."accion") IN (
    'pedidos/ver',
    'pedidos/cambiar_estado',
    'caja/abrir',
    'caja/cobrar',
    'caja/movimientos',
    'caja/cerrar',
    'caja/ver',
    'cocina/ver',
    'catalogo/ver',
    'comprobantes/ver',
    'comprobantes/reimprimir',
    'mesas/ver',
    'mesas/liberar',
    'repartos/ver',
    'repartos/liquidar'
  )
ON CONFLICT DO NOTHING;
