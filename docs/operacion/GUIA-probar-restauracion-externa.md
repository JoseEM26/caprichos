# Guía: probar la restauración desde el respaldo externo

## Qué hace

Demuestra que, si se pierde el servidor, el respaldo que está fuera de él (restic en Backblaze B2) se puede recuperar.
Es distinta de `probar-restauracion`, que solo usa el volcado local de `/opt/caprichos/respaldos/<ambiente>`.

El script `infra/compose/scripts/probar-restauracion-externa.sh <demo|prod>` en el VPS:

1. Lee `/opt/caprichos/restic.env` (si no existe, termina con un mensaje claro).
2. Lista los snapshots con la etiqueta del ambiente y avisa si el último tiene más de 48 h.
3. Corre `restic check` (rápido: estructura e índices; no relee todos los datos).
4. Baja a `/tmp` (permisos 077) el volcado `db_<ambiente>_*.sql.gz` del snapshot más reciente que lo tenga
   (revisa hasta los 5 últimos).
5. Lo restaura en un PostgreSQL temporal y aislado (nunca toca la base real) y cuenta tablas y filas clave.
6. Borra siempre el contenedor y el directorio temporal. No imprime secretos ni datos, solo conteos.

Es solo lectura sobre el repositorio y el servidor.

## Cómo se lanza

Demo (desde `preprod`):

```
gh workflow run deploy.yml --ref preprod -f accion=probar-restauracion-externa -f ambiente=demo
```

Producción (tag en `main` y confirmación):

```
gh workflow run deploy.yml --ref main -f accion=probar-restauracion-externa -f ambiente=prod -f tag=vX.Y.Z -f confirmacion=PRODUCCION
```

El resumen de la ejecución (GITHUB_STEP_SUMMARY) muestra las líneas Snapshot, Tablas, Filas y OK/FALLA.

## Qué significa cada resultado

- `OK: el respaldo externo se restaura sin errores`: el respaldo externo sirve. Revise que `Snapshot` diga pocas horas
  y que las filas de `producto`, `user_account` y `pedido` tengan sentido.
- `AVISO: ... más de 48 horas`: la restauración funcionó, pero el respaldo externo está atrasado
  (el cron de prod es diario; el de demo es semanal, así que en demo el aviso es esperable).
- `FALLA: no se pudo listar snapshots`: credenciales, bucket o dirección mal, o aún no hay respaldos con esa etiqueta.
- `FALLA: restic check reportó problemas`: el repositorio tiene daño de estructura. Es grave: avise de inmediato.
- `FALLA: ninguno de los últimos snapshots contiene db_...`: se están subiendo respaldos sin el volcado de la base.
- `FALLA: la restauración dio errores`: el volcado llegó pero no restaura; compare con `probar-restauracion` (local).

## Costo de lectura en Backblaze

Solo lecturas: listar el repositorio, `check` (índices y estructura, sin `--read-data-subset`) y descargar los
paquetes del volcado de la base, aproximadamente el tamaño del `.sql.gz`. Es poco; ejecutarla una vez por semana o mes
es razonable. No se escribe nada en el bucket.

## Si falla

1. Lea el log del paso «Restaurar el respaldo externo» (los secretos salen tapados con `***`).
2. En el VPS, con `/opt/caprichos/restic.env`, pruebe `docker run --rm --env-file /opt/caprichos/restic.env restic/restic:0.17.3 snapshots`.
3. Si la clave o el bucket cambiaron, vuelva a correr `programar-respaldos` con las credenciales nuevas.
4. Si falla `check` o falta el volcado, no borre nada y lance un respaldo manual (`respaldar.sh`) para tener uno bueno.
