# Reconstruir puntos por ventas anteriores

Acredita los puntos de las ventas **pagadas** que nunca sumaron (clientes con 0 puntos en Admin > Clientes aunque compraron con su celular).

## Por qué NO es una migración de Prisma

Una migración corre sola en cada despliegue, sin que nadie vea el resultado. Esto reparte dinero (puntos canjeables): un cálculo equivocado acreditaría puntos sin revisión y no se puede deshacer en bloque. Por eso es un script manual con **simulacro por defecto**.

## Qué hace

- Toma los pedidos con `pago_estado = PAGADO`, que no estén ANULADO ni RECHAZADO, sin movimiento `SUMA`, y con celular o cliente.
- Para cada uno llama a `PuntosService.acumularPorPedido`, la **misma función** del cobro en vivo: porcentaje `puntos_porcentaje` **vigente hoy**, solo productos sin descuento ni promoción, sin cortesías, sin cupón, restando lo canjeado. Si el porcentaje o la regla cambiaron desde la venta, se aplica el de hoy.
- El celular se normaliza (`+51 987 654 321` = `987654321`) y se reutiliza el party existente; si no hay, se crea como cliente sin verificar (sin contraseña). No se acredita al relleno `999999999`, a celulares inválidos, a cuentas desactivadas ni a quien se dio de baja como cliente.
- Cada movimiento queda como `SUMA` con motivo «Reconstrucción de puntos por ventas anteriores · pedido CÓDIGO», ligado al pedido, y el pedido queda ligado al cliente (`cliente_party_id`).
- Idempotente: la BD tiene único `(pedido_id, tipo)` en `movimiento_puntos` y el filtro salta lo ya sumado. Correrlo dos veces no duplica.
- Auditoría `RECONSTRUIR_PUNTOS` (módulo puntos) con el total.

## Cómo correrlo

1. Despliegue primero la versión que trae el script (en prod, un tag en main).
2. GitHub Actions > Deploy > `accion = reconstruir-puntos`, `aplicar_puntos` apagado (simulacro). En prod: `confirmacion = PRODUCCION` y el `tag` desplegado. Demo se lanza desde `preprod`.
3. Revise el resumen: pedidos, clientes, total de puntos, cuentas nuevas, omitidos y top 10 (celular enmascarado).
4. Si cuadra, repita con `aplicar_puntos = true`.

En consola del contenedor de la API: `node dist/scripts/reconstruir-puntos.js` (simulacro) o `... --aplicar`.

## Límites conocidos

- Un pedido anulado después de acreditar se reversa con el flujo normal de anulación.
- Teléfonos guardados en contactos con formato raro (espacios, `+`) no se reconocen como el mismo celular; el pedido sí se normaliza.
