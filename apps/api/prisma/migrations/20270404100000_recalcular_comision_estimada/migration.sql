-- La comision ESTIMADA sumaba el IGV 18 % encima de una tarifa que ya lo incluye. Se recalcula sin IGV (solo fuente ESTIMADA).
-- El neto sube lo mismo que baja la comision (conserva la base de monto con que se calculo).
UPDATE "cobro_pago"
SET "comision_detalle" = "comision_detalle" || jsonb_build_object(
      'igv', 0,
      'neto_depositado', ROUND(("comision_detalle"->>'neto_depositado')::numeric + "comision_pasarela"
        - (COALESCE(("comision_detalle"->>'fijo')::numeric, 0) + COALESCE(("comision_detalle"->>'variable')::numeric, 0)), 2)),
    "comision_pasarela" = ROUND(COALESCE(("comision_detalle"->>'fijo')::numeric, 0) + COALESCE(("comision_detalle"->>'variable')::numeric, 0), 2)
WHERE "origen" = 'CULQI' AND "comision_pasarela" IS NOT NULL
  AND "comision_detalle"->>'fuente' = 'ESTIMADA' AND "comision_detalle"->>'variable' IS NOT NULL AND "comision_detalle"->>'neto_depositado' IS NOT NULL;
