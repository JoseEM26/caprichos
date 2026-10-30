# Sanear clientes y DNI

**Irreversible. Solo local y demo. Producción nunca.** Es una limpieza para evitar fuga de datos de clientes (al quitar el DNI del sistema); no es un borrado general.

## Qué borra (cuentas de clientes)

Un cliente es un `party` **sin** cuenta de sistema (y que no sea organización, proveedor ni trabajador). Se borran, solo de esos clientes: `party`, `person`, `party_identifier` (DNI/CE), `party_role`, `customer_detail` (puntos), `customer_account` (clave), `consent`, `contact_mechanism`, `sesion`, `cliente_direccion`, `movimiento_puntos` y `data_request`.

## Qué anonimiza (la fila se queda)

- `pedido.comprobante_doc` y `comprobante_razon` cuando el documento es un DNI (8 dígitos); los RUC de 11 dígitos se conservan.
- `comprobante.documento` y `razon_social` cuando es DNI.
- `reclamo.documento` (se vacía; la columna es obligatoria) salvo RUC de 11 dígitos.
- `pedido.party_id`, `pedido.cliente_party_id`, `conversacion.party_id`, `notificacion.party_destino` y `cupon_canje_compartido.party_id` pasan a NULL: el pedido queda como venta de un invitado. Los teléfonos y el historial del bot no se tocan.

## Qué conserva

Todo lo demás: recetas, insumos, stock y compras, carta y ofertas, zonas, plano, horarios, parámetros, personal y permisos, historial del bot (conversaciones, mensajes, salientes, IA), pedidos y líneas, cobros, cajas, cierres, vouchers y sus archivos, comprobantes, encuestas, reservas, notificaciones y auditoría. Lista exacta en `apps/api/prisma/reset/clasificacion-tablas.ts`; una prueba falla si se agrega una tabla sin clasificar.

Límite: la auditoría es inmutable, así que si algún JSON suyo guarda un DNI no se toca. El simulacro lista "posibles DNI en otras columnas" (valores de exactamente 8 dígitos) para revisarlos a mano.

## Local

Base `caprichos-pg-dev` (puerto 5442). Desde `apps/api`:

```bash
# Simulacro (por defecto): filas a borrar, columnas a anonimizar y qué se conserva; no escribe
ENTORNO_DATOS=local pnpm sanear:clientes-dni --confirmar="SANEAR CLIENTES DNI"

# Real (con respaldo de las tablas afectadas; sin pg_dump usar --sin-respaldo de forma explícita)
ENTORNO_DATOS=local pnpm sanear:clientes-dni --confirmar="SANEAR CLIENTES DNI" \
  --ejecutar --respaldo=/ruta/respaldo.dump
```

Se niega si falta la confirmación literal, si `ENTORNO_DATOS` no es `local` o `demo`, si el host o la base no están en la lista permitida, si `parametro.entorno` vale `PRODUCCION` o si hay comprobantes `EMITIDO` a SUNAT (ajustable con `--max-comprobantes-emitidos` y `--umbral`). Todo va en una transacción.

## Demo

GitHub > Actions > **Deploy Caprichos por SSH** > Run workflow en la rama `preprod`: ambiente `demo`, acción `sanear-demo`, confirmación `SANEAR CLIENTES DE LA DEMO` y `simulacro` marcado para ver el informe. (Un flujo aparte no se puede lanzar a mano desde `preprod`: GitHub solo lista los que están en la rama principal, por eso el saneamiento vive en el flujo de despliegue ya registrado.) Para sanear, repetir con `simulacro` desmarcado: antes se hace un respaldo completo en el VPS (`/opt/caprichos/respaldos/demo`).

## Después

Los clientes se vuelven a registrar. El personal sigue entrando con su DNI y clave. Redis no guarda sesiones de cliente (la sesión es la cookie `cp_cliente` más la tabla `sesion`), así que no hay nada que limpiar allí; las cookies viejas dejan de valer porque su cuenta ya no existe.

## Producción

No hay ruta a producción: ni el workflow ni el script la aceptan. Para blindarla más, marcar su base una sola vez con `INSERT INTO parametro (clave, valor) VALUES ('entorno', '"PRODUCCION"')`; el script aborta si encuentra esa marca.
