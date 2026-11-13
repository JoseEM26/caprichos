# Cargar sueldos (script de consola)

Guarda el sueldo mensual del personal que **ya tiene cuenta** (`sueldo_personal`), desde un CSV. Acción `cargar-sueldos`
del workflow `deploy.yml` (ambiente `demo` desde la rama `preprod`, o `prod` con `PRODUCCION` y un tag en `main`).
`importar-personal` no sirve para esto: omite a quien ya existe.

## Reglas

- **Nunca crea usuarios.** El documento que no coincide con una cuenta sale `sin usuario`. Quien no está en el CSV no se toca (sin sueldo, sin fila).
- **Simulacro por defecto** (`aplicar_sueldos = false`): dice `crearía`, `cambiaría`, `sin cambio`, `sin usuario`, `omitida` o `error`.
- **Aplicar** (`aplicar_sueldos = true`): una transacción por fila (sueldo + auditoría `CARGAR_SUELDOS` como sistema, con antes y después). Si ya hay un sueldo distinto, lo sobreescribe; nunca borra filas.
- Sueldo vacío, cero o no numérico: `omitida` (queda vacío). El ADMIN no lleva planilla: `error`.
- Idempotente: una segunda corrida da `sin cambio`.
- **Nunca se imprimen documentos, celulares ni montos.** Cada línea trae solo el número de línea del CSV, el resultado y el nombre de pila.
- El sueldo es `MENSUAL`; el semanal sale de la misma fórmula de la planilla (`sueldoEquivalente`, mensual × 12 / 52). Método de valor hora `DIAS_HORAS` en altas nuevas; en cambios conserva el que tenga la persona, salvo que el CSV traiga `dias_mes` / `horas_dia`.
- `acuerdo_laboral` y `tipo_documento` se aceptan pero se ignoran (el acuerdo vive en el vínculo laboral, que solo crea `importar-personal`).

## Formato del CSV

```
documento,sueldo_mensual,acuerdo_laboral
```

Opcionales: `dias_mes` (1 a 31), `horas_dia` (0 a 24), `pago_celular`, `pago_medio` (`YAPE`, `PLIN`, `TRANSFERENCIA`, `EFECTIVO`).
`documento` se normaliza (sin espacios, puntos ni guiones, en mayúsculas); DNI de 8 dígitos o 7 a 12 letras o números.

## Pasos

1. Generar el CSV desde el Excel del dueño, en tu PC y fuera del repositorio:
   `python3 -I apps/api/scripts/xlsx-a-csv-sueldos.py "<pagos>.xlsx" ~/Descargas/sueldos-caprichos.csv`
   (usa la hoja «Hoja3»; la cruza con «PAGOS» y solo imprime conteos y nombres de pila de las diferencias).
2. Guardar el secreto del ambiente (nunca el CSV en Git):
   `base64 -w0 ~/Descargas/sueldos-caprichos.csv > /tmp/sueldos.b64 && gh secret set SUELDOS_CSV_B64 --env <demo|prod> < /tmp/sueldos.b64 && shred -u /tmp/sueldos.b64`
3. Correr el simulacro: Actions > Deploy > acción `cargar-sueldos`, `aplicar_sueldos` apagado. Revisar el resumen (`cambiaría` = ya tenía otro sueldo).
4. Si todo está bien, repetir con `aplicar_sueldos = true`, y una tercera vez para comprobar `sin cambio`.
5. Borrar el secreto cuando termine: `gh secret delete SUELDOS_CSV_B64 --env <ambiente>`.

A mano en el servidor (carpeta `/app/apps/api` del contenedor de la API):
`node dist/scripts/cargar-sueldos.js --archivo /ruta/sueldos.csv [--aplicar]` o `--desde-env SUELDOS_CSV_B64`.
