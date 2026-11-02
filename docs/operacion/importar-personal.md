# Importar personal (script de consola)

Crea las cuentas del personal desde un CSV, dentro del contenedor de la API. Corre con la acción
`importar-personal` del workflow `deploy.yml` (ambiente `demo` o `prod`).

## Reglas

- **Simulacro por defecto.** `aplicar_personal = false` no escribe nada: dice por fila `crear`, `ya existe` o `error: motivo`.
- **Aplicar** (`aplicar_personal = true`) crea las cuentas, una transacción por fila. Los documentos que ya existen se omiten sin tocarlos.
- **Clave inicial = número de documento**, con `debe_cambiar = true`. Al entrar por primera vez la persona cambia la clave; la nueva no puede ser su documento.
- La salida del script no trae claves ni documentos. Sí trae nombre y rol por fila (ver «Pendiente» abajo).
- El CSV nunca va al repositorio ni a disco del runner. Llega como secreto en base64.
- En `prod` la acción exige la confirmación `PRODUCCION` y un tag existente en `main`, igual que cualquier despliegue a producción.
- En `demo` la acción se lanza desde la rama `preprod`.

## Formato del CSV

Encabezado obligatorio (los demás campos son opcionales):

```
nombres,apellidos,tipo_documento,documento,celular,fecha_nacimiento,fecha_ingreso,fecha_reingreso,pais_nacimiento,rol_principal,roles_extra,activo
```

- `tipo_documento`: `DNI` (vacío = DNI), `CE`, `CEDULA` o `PASAPORTE`.
- `documento`: DNI de 8 dígitos; los demás de 7 a 12 letras o números.
- `celular`: vacío es válido; si se escribe, 9 dígitos y empieza en 9.
- Fechas en `AAAA-MM-DD`.
- Historial laboral: `fecha_ingreso` abre el primer periodo trabajado. Si hay `fecha_reingreso`, el primer periodo queda cerrado el día anterior al reingreso y el segundo queda abierto; la fila sale con el aviso «Fecha de salida no registrada: corregir en el historial laboral», porque la salida no está en el CSV. Con `activo = no` la persona queda en licencia (periodo abierto, cuenta inactiva).
- `roles_extra`: roles adicionales separados por `|`, p. ej. `MOZO|ALMACEN`.
- `activo`: `si` o `no` (vacío = si).

## Pasos

1. Guardar el CSV en base64 como secreto (en el ambiente correspondiente):

   ```bash
   base64 -w 0 personal.csv > personal.b64
   gh secret set PERSONAL_CSV_B64 --env demo < personal.b64     # o --env prod
   rm personal.b64 personal.csv
   ```

2. Correr el **simulacro** desde Actions: `deploy.yml` → Run workflow → `accion = importar-personal`,
   `ambiente = demo` (o `prod`), `aplicar_personal = false`. Revisar el resumen del job.

3. Si el simulacro sale bien, correr otra vez con `aplicar_personal = true`.
   En `prod` pide además la confirmación `PRODUCCION` y el tag.

4. **Borrar el secreto** cuando ya no haga falta:

   ```bash
   gh secret delete PERSONAL_CSV_B64 --env prod
   ```

## Errores frecuentes

- «Falta el secreto PERSONAL_CSV_B64»: no se guardó el secreto en ese ambiente (paso 1).
- «Faltan columnas en el encabezado»: revisa los nombres de la fila 1 del CSV.
- Fila con `error: ...`: se corrige en el CSV y se vuelve a correr el simulacro.

## Pendiente

- La salida del script incluye nombre y rol por fila. Confirmar si el dueño quiere quitar los nombres del log del workflow.
