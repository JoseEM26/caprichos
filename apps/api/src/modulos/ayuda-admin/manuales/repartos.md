---
modulo: repartos
titulo: Repartos
ruta: /admin/repartos
permiso: repartos/ver
roles: [ADMIN, CAJERO, REPARTIDOR]
relacionados: [caja, cocina, cierre, zonas]
sugerencias:
  - Como tomo un pedido disponible para reparto
  - Como cambio el estado a En camino y Entregado
  - Que hago si llego a la direccion y el cliente no contesta
  - Como inicio una ruta sugerida con varios pedidos
---
# Repartos

## Para que sirve
Modulo de asignacion, enrutamiento y seguimiento de pedidos a domicilio. Cuenta con mapa en tiempo real delimitado por [[zonas]], optimizador de rutas con pedidos preparados en [[cocina]], control de cobranzas para [[caja]] y rendicion en [[cierre]].

## Como se hace: Tomar pedidos e iniciar una ruta
1. En la pestana Disponibles o desde el modo Mapa delimitado por [[zonas]], revisar los pedidos listos para salir preparados por [[cocina]].
2. Pulsar el boton Tomar pedido en la orden individual o seleccionar la opcion Iniciar ruta sugerida para agrupar pedidos cercanos del mismo sector.
3. El pedido pasara a la lista de Mis pedidos del motorizado.
Antes: [[cocina]]
Ver tambien: [[zonas]]

## Como se hace: Registrar el ciclo de entrega en camino
1. Al salir del local con los paquetes, pulsar el boton Salir en la tarjeta del pedido. El estado cambia a En camino.
2. Al llegar a la direccion del cliente, pulsar el boton Llegue.
3. Tras entregar el paquete y cobrar (si el pago era en efectivo al recibir), pulsar el boton Entregar.
4. Si el pedido requeria cobro en efectivo, la pantalla mostrara el monto exacto cobrado que debe ser rendido en [[cierre]] al regresar.
Antes: [[repartos]]
Despues: [[cierre]]
Ver tambien: [[caja]]

## Como se hace: Reportar una falla en la entrega (no contesta o direccion erronea)
1. Si transcurren varios minutos sin poder contactar al cliente, pulsar el boton Reportar falla.
2. Seleccionar el motivo: No contesta o Direccion no encontrada.
3. Marcar los intentos de contacto realizados mediante llamada telefonica y notificaciones de [[mensajes]].
4. Opcionalmente adjuntar una foto de la fachada o comprobante del intento de entrega.
5. Pulsar Enviar reporte. El incidente se notificara a la central y a caja para coordinar la solucion.
Ver tambien: [[mensajes]]

## Como se hace: Resolver un incidente reportado (Supervisor o Caja)
1. Abrir el pedido con falla reportada y pulsar Resolver incidente.
2. Seleccionar la solucion: Reprogramado para mas tarde, Devuelto al local o Cobrado igual con recargo de flete.
3. Escribir la nota de resolucion y confirmar para actualizar el saldo en [[caja]].
Despues: [[caja]]
Ver tambien: [[cierre]]

## Errores y dudas comunes
- Si otro repartidor toma una orden simultaneamente, el sistema mostrara un aviso de pedido no disponible para evitar entregas duplicadas.
- Se puede alternar entre la vista de Mapa y la vista de Lista pulsando el interruptor de modo en la barra superior.
- Los pedidos que no se entreguen deben ser devueltos fisicamente al local antes de terminar el turno.

## Quien puede hacerlo
- Repartidores: ver pedidos disponibles, tomar asignaciones, actualizar estados de viaje (salir, llegue, entregar) y reportar fallas.
- Administrador y Cajero: supervisar todos los pedidos en el mapa, reasignar pedidos entre repartidores, resolver fallas y liquidar cuentas.
