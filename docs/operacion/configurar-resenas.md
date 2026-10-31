# Configurar la clave de reseñas de Google (OpenWebNinja)

Guarda la clave de OpenWebNinja en el servidor del ambiente y redespliega la API con la misma versión. La clave nunca va en el código ni aparece en el log de GitHub.

## Qué hace la acción

- Lee el secreto `OPENWEBNINJA_API_KEY` de GitHub y lo envía al servidor por la entrada estándar del SSH.
- En `/opt/caprichos/<ambiente>/.env` cambia solo `OPENWEBNINJA_API_KEY` y `RESENAS_ACTUALIZAR_AUTO`:
  - demo: `RESENAS_ACTUALIZAR_AUTO=no` (la demo no se actualiza sola).
  - prod: `RESENAS_ACTUALIZAR_AUTO=si` (se actualiza cada semana).
- Redespliega con el mismo `TAG` y comprueba que la API responde `/salud` y recibe la clave.
- Si algo falla, restaura la copia fechada del `.env` y vuelve a desplegar.

## Pasos para el dueño (en este orden)

1. Guardar la clave como secreto de GitHub desde la terminal. `gh` la pide sin mostrarla: pegue la clave y pulse Enter.

   ```bash
   gh secret set OPENWEBNINJA_API_KEY --repo JoseEM26/caprichos
   ```

2. Configurar la clave en la demo:

   ```bash
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref preprod \
     -f ambiente=demo -f accion=configurar-resenas
   ```

   Revisar el resumen del job: debe decir `OPENWEBNINJA_API_KEY: configurada (N caracteres)` y `OK`.

3. Cargar las reseñas del local en la demo:

   ```bash
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref preprod \
     -f ambiente=demo -f accion=cargar-resenas -f "consulta_resenas=Caprichos Campoy"
   ```

   Para volver a cargar aunque ya haya reseñas, añadir `-f repetir_resenas=true`.
   Si la búsqueda es ambigua, el comando sale con código 2 y muestra los candidatos: repetir el paso con el `business_id` exacto (`-f "consulta_resenas=0x…:0x…"`).

4. Revisar en la demo: **/admin/resenas**.

5. Importar a producción, cuando la demo esté bien: con `importar-datos-produccion` (ver `migrar-datos-empresa.md`). Las reseñas viajan con los datos de la empresa; cargarlas directamente en producción no es lo normal.

Para producción de la clave, repetir el paso 2 con `--ref main -f ambiente=prod -f tag=v0.3.0 -f confirmacion=PRODUCCION` (el tag tiene que estar integrado en `main`). El job de producción usa el entorno `prod`, así que puede pedir aprobación.

`cargar-resenas` en producción también pide `confirmacion=PRODUCCION` y `tag`; el resumen avisa que lo normal es no cargar allí.

## Qué muestra el log

Solo la longitud de la clave, nunca la clave ni el `.env`:

```
== Reseñas de Google (demo) ==
OPENWEBNINJA_API_KEY: configurada (32 caracteres)
RESENAS_ACTUALIZAR_AUTO=no
TAG=v0.3.0 (no cambia)
Copia del .env: /opt/caprichos/demo/.env.bak-20261031-101500
...
OK: reseñas configuradas en demo (TAG v0.3.0).
```

## Reglas de la clave

- 10 a 200 caracteres, solo letras, números y `. _ ~ + / = -`.
- Sin espacios ni saltos de línea. Si la clave trae otros caracteres, el script la rechaza con un mensaje claro.
- Si el secreto está vacío, el job falla antes de conectarse al servidor.

## Si falla

- `Falta el secreto OPENWEBNINJA_API_KEY`: guardar el secreto con `gh secret set` y volver a correr.
- `la clave no tiene formato válido`: revisar que se copió completa y sin espacios.
- `Se restauró ...`: el `.env` volvió a su estado anterior y la API se redespliega con la configuración previa. Revisar el log del job.
