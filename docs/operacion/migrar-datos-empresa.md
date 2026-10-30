# Migrar los datos de la empresa de la demo a producción

Esta guía explica cómo llevar la configuración y el contenido que Kevin cargó en la demo
(`https://caprichos.pe`) a la base nueva de producción, sin pasar pedidos, cajas ni clientes.

Herramientas: `apps/api/prisma/migracion-datos/` (código) y las acciones `respaldar-demo`,
`exportar-datos-demo` e `importar-datos-produccion` de `.github/workflows/deploy.yml`.

## Qué pasa y qué no

**Pasa** (solo lo activo o visible):

- Parámetros de configuración: datos del local, medios de pago, horarios de atención, tiempos,
  textos legales (términos y privacidad), bot (textos y funciones activas), voucher, puntos.
- Horario semanal y fechas especiales (desde hoy en adelante).
- Carta: áreas de cocina, categorías no ocultas, productos no ocultos, tamaños, grupos de
  opciones y opciones activas, sabores, listas de valores.
- Ofertas activas y vigentes, combos (partes, precios, reemplazos) y cupones fijos activos.
- Zonas de reparto activas, plano de mesas (pisos y elementos activos).
- Recetas, insumos y su catálogo de lugares de stock. **Sin** saldos ni movimientos.
- Contenido: novedades activas (con sus fotos), destacadas no archivadas (con sus fotos),
  respuestas rápidas activas, versión publicada de la carta (diseño, paleta, banner, promos).
- Fotos del local (`foto_local`, tabla que hoy no usa nadie; la llenará otro agente).
- Personal: cuentas activas con su rol, nombre y DNI, horarios de trabajo, reemplazos y
  coberturas vigentes. Proveedores activos (razón social y RUC).
- Permisos por rol (matriz de la configuración).

**No pasa** (nunca):

- Pedidos y sus líneas, cobros, cajas, cierres, vouchers, comprobantes y reclamos.
- Clientes: cuentas, puntos, direcciones, consentimientos, cupones emitidos.
- Conversaciones, mensajes y salientes de WhatsApp, notificaciones, encuestas, reservas.
- Auditoría, sesiones, llaves de dispositivos (agente de impresión), colas de impresión.
- Secretos del supervisor, contraseñas, hashes y PIN.
- Stock, movimientos de stock, compras, pedidos a proveedores, producciones.
- Cachés y contadores (`wa_media:*`, `wa_aviso_consumo:*`), borradores (`*_borrador`) y el
  marcador `entorno`.

La lista completa y el motivo de cada tabla están en `apps/api/prisma/migracion-datos/clasificacion.ts`.

## Antes de exportar: lo de prueba

Kevin revisa la demo y **desactiva a mano** lo que es de prueba, porque lo que siga activo sale:

- Productos, categorías, ofertas y cupones de prueba: ocultarlos o desactivarlos.
- Cuentas de prueba del personal: desactivarlas. En la demo hay cuentas con DNI de prueba
  (`10000000`, `12345678`); si siguen activas, salen en el paquete.
- Novedades y destacadas de prueba: archivarlas o desactivarlas.

El reporte (`reporte.md`) muestra todo lo que saldría. Si algo sobra, se desactiva en la demo y
se vuelve a exportar.

## Comandos locales (desarrollo)

Desde `apps/api`, con las variables en el entorno (nunca se leen de `.env`):

```bash
# Simulacro de exportación: solo reporte, sin datos ni archivos
ENTORNO_DATOS=local DATABASE_URL='postgresql://…' pnpm datos:exportar --salida=/ruta/paquete --solo-reporte

# Exportación completa: datos.json, archivos/, manifiesto.json, reporte.md y .tar.gz
ENTORNO_DATOS=local DATABASE_URL='postgresql://…' pnpm datos:exportar --salida=/ruta/paquete

# Importación en simulacro (por defecto: no escribe)
ENTORNO_DATOS=local DATABASE_URL='postgresql://…' UPLOADS_DIR=/ruta/uploads pnpm datos:importar --paquete=/ruta/paquete

# Importación real (escribe en una transacción; exige respaldo o confirmación de que ya existe)
ENTORNO_DATOS=local DATABASE_URL='postgresql://…' UPLOADS_DIR=/ruta/uploads \
  pnpm datos:importar --paquete=/ruta/paquete --confirmar="IMPORTAR DATOS DE LA EMPRESA" --sin-respaldo

# Clave inicial para una cuenta (la muestra una sola vez en la terminal)
ENTORNO_DATOS=local DATABASE_URL='postgresql://…' pnpm datos:clave-inicial --dni=12345678 --confirmar="GENERAR CLAVE INICIAL"
```

Opciones de la importación: `--sobrescribir` actualiza lo que ya existe y es distinto (sin él se
omite y se informa). Nunca borra nada.

## De la demo a producción, paso a paso

1. **Preparar la demo.** Kevin deja activo solo lo real (ver «Antes de exportar»).
2. **Respaldo de la demo (opcional, recomendado).** Workflow `deploy.yml` → *Run workflow* →
   rama `preprod`, ambiente `demo`, acción `respaldar-demo`, confirmación `RESPALDAR DEMO`.
   Ejecuta `respaldar.sh demo` en el VPS. No hay programación automática.
3. **Exportar.** Acción `exportar-datos-demo`, confirmación `EXPORTAR DATOS DE LA DEMO`, rama `preprod`.
   El paquete queda en el VPS en `/opt/caprichos/respaldos/datos-empresa/<fecha>/paquete/`
   (permisos 0600). El job muestra el `reporte.md` en su resumen.
4. **Revisar el reporte.** Ver «Cómo revisar el reporte». No avanzar si algo no cuadra.
5. **Simulacro en producción.** Acción `importar-datos-produccion`, ambiente `prod`, `paquete` =
   la fecha de la exportación (p. ej. `20261030_120000`), `frase_datos` =
   `IMPORTAR DATOS DE LA EMPRESA`, `confirmacion` = `PRODUCCION`, `tag` = la versión (p. ej. `v0.3.0`,
   integrada en `main`), `simulacro` = `true` (por defecto). No escribe; muestra por tabla qué
   crearía, actualizaría u omitiría.
6. **Importación real.** Igual que el paso 5, con `simulacro` = `false`. Antes de escribir, el
   workflow hace un respaldo completo de producción (`respaldar.sh prod`). Si el respaldo falla,
   no se importa. El job usa el entorno `prod` de GitHub: si ese entorno tiene revisores
   configurados, GitHub pide la aprobación antes de correrlo.
7. **Primer ingreso.** La importación crea las cuentas con una clave aleatoria que nadie ve y
   con «debe cambiar la clave». Para entrar, el administrador genera la clave inicial de cada
   cuenta con `datos:clave-inicial` (o con «Restablecer clave» desde Usuarios, cuando ya haya
   un administrador que entre). Para el primer administrador, el operador lo hace por SSH en el VPS.
8. **Verificar.** Comparar la carta, el local y el personal en producción con la demo.
9. **Repetir si hace falta.** La importación es idempotente: volver a correrla no duplica nada.

## Cómo revisar el reporte

El `reporte.md` tiene, en este orden:

- **Resumen por tipo**: filas que salen y filas omitidas por tabla.
- **Personal**: DNI enmascarado (`DNI:12345***`), nombre, cuenta y rol, cantidad de horarios.
  No sale ninguna contraseña.
- **Contenido por tipo**: nombres de parámetros, categorías, productos, ofertas, novedades, etc.
- **Omitidas**: cada fila que no sale con su motivo. «inactiva o no visible» es lo que
  Kevin dejó apagado; «depende de X que no sale» significa que su categoría, grupo u oferta padre
  no sale.
- **Avisos**: imágenes que no pudieron salir o enlaces que quedaron vacíos.
- **Lo que NO sale**: las tablas excluidas, agrupadas por motivo.

Si una cuenta de prueba, un producto de prueba o un DNI real de un cliente aparece en el reporte,
no se importa: se corrige en la demo y se exporta otra vez.

## Límites y riesgos conocidos

- **Base vacía (resuelto).** Las migraciones `20261024100000_cajero_permisos`,
  `20261029000100_vouchers_permisos` y `20261031000000_mascota_permisos` asignaban permisos a roles que
  solo crea `prisma/seed.ts`, y fallaban en una base nueva. Ahora asignan el permiso solo si el rol
  ya existe (el servidor sincroniza los permisos de cada rol al arrancar). Comprobado: una base
  vacía aplica las 60 migraciones. Orden para crear producción: 1) `prisma migrate deploy`;
  2) `prisma/seed.ts` (crea los roles y un primer administrador con clave ALEATORIA que se imprime una
  sola vez y debe cambiarse al ingresar; nunca se usan los seeds de demo con claves conocidas);
  3) reiniciar la API (si ya estaba corriendo, para que sincronice los permisos de los roles recién creados);
  4) importar el paquete de datos.
- **Respaldo previo sin pg_dump.** La imagen de la API no trae `pg_dump`, así que la importación
  usa `--sin-respaldo` tras correr `respaldar.sh prod` en el VPS. Con `--respaldo=<ruta>` en un
  equipo con `pg_dump`, la herramienta hace el volcado de las tablas que toca.
- **Imágenes del repo.** Las rutas `/imagenes/...` (fotos de marca del seed) son archivos del
  repositorio web: viajan como ruta, no como fichero.
- **Carta.** Solo sale la versión PUBLICADA más reciente; los borradores no. Si producción ya
  tiene una versión publicada, la importada queda también como PUBLICADA y gana la de id más alto.
- **Listas vacías.** Una lista escalar nula (p. ej. `oferta.dias`) se exporta como vacía; la
  aplicación trata ambas igual.
- **Clave natural.** Dos filas con la misma clave natural en origen se consideran la misma
  (la segunda se omite y se informa).
- **Campo `foto_local.slot`.** Lo introduce una migración pendiente de otro agente. El
  exportador lee con `SELECT *`, así que sale lo que tenga cada base.
- **Sin prueba en el VPS.** El workflow y los scripts `exportar-datos-empresa.sh` /
  `importar-datos-empresa.sh` se validaron (YAML y sintaxis bash), pero no se ejecutaron en el VPS.
- **Paquete con datos personales.** `datos.json` lleva DNI completos y nombres. Vive solo en el
  VPS, con permisos 0600. No se sube a Git ni se pega en chats.
