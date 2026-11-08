---
modulo: escritorio
titulo: Escritorio
ruta: /admin
permiso:
roles: [ADMIN, CAJERO, COCINA, MOZO, ALMACEN, REPARTIDOR, SUPERVISOR]
relacionados: [caja, cocina, repartos, compras, informes, reservas, plano, notificaciones]
sugerencias:
  - Como cambio el periodo de fechas para ver las ventas
  - Donde veo si algun insumo se esta quedando sin stock
  - Por que no veo los graficos de ventas en mi usuario
  - Que significan los pedidos pendientes en mi pantalla
  - Que veo en el escritorio del supervisor
  - Por que el supervisor no ve dinero en su escritorio
---
# Escritorio

## Para que sirve
Es el panel principal de bienvenida y resumen de la operacion diaria. Muestra indicadores del negocio, graficos y accesos rapidos adaptados a las funciones y permisos de cada puesto de trabajo en conexion con modulos como [[caja]], [[cocina]] y [[repartos]].

## Como se hace: Filtrar las ventas por fecha o canal
1. En la parte superior de la pantalla, pulsar el boton Filtros.
2. En el selector Periodo, elegir Hoy, 7 dias, 30 dias, 90 dias o Ano. Tambien se puede cambiar el ano o escribir fechas especificas en los campos Desde y Hasta.
3. En el selector Canal, elegir Todos, Salon, Delivery, Web o WhatsApp.
4. Para volver al rango inicial de los ultimos 30 dias, pulsar el boton Limpiar filtros.
Ver tambien: [[informes]]

## Como se hace: Atender la alerta de stock bajo
1. Si hay insumos por debajo del minimo requerido en [[stock]], aparece una tarjeta de alerta en la parte superior con el titulo y detalle del insumo.
2. Pulsar el boton Pedir al proveedor dentro de la tarjeta de aviso.
3. El sistema abrira directamente el modulo de [[compras]] en la pestana de pedidos a proveedores con la lista sugerida.
Despues: [[compras]]
Ver tambien: [[stock]]

## Como se hace: Revisar pendientes y tareas del turno
1. En la seccion inferior del panel, revisar los contadores de tareas pendientes segun el puesto asignado.
2. Pulsar sobre cualquiera de los enlaces de acceso directo para abrir el modulo correspondiente, como [[caja]] (Pedidos y caja), [[cocina]] o [[repartos]].
Ver tambien: [[caja]], [[cocina]], [[repartos]]

## Como se hace: Usar el escritorio del Supervisor
1. Si tu rol es Supervisor, el escritorio es propio y no muestra dinero ni graficos de ventas: sirve para vigilar la operacion del dia.
2. Pedidos: contadores Por confirmar, En cola, En preparacion, Listos, En reparto y No entregados. Al tocar uno abre Pedidos y caja, Cocina o Repartos.
3. Reservas de hoy: "Reservas para hoy", que abre [[reservas]].
4. Salon y caja: "Mesas ocupadas de N" y "Mesas libres" (abren el [[plano]]) y "Caja de hoy" con su estado: Abierta, Cerrada o Sin abrir hoy.
5. Avisos: cuantos avisos sin leer tienes; abre [[notificaciones]]. El Supervisor recibe los avisos de caja.

## Como se hace: Entender de donde salen las cifras
1. Mirar el rango de fechas que aparece arriba de las tarjetas: por defecto son los ultimos 30 dias.
2. Las cifras corresponden a ese periodo y al canal elegido (Todos, Salon, Delivery, Web o WhatsApp). Para cambiarlos, usar el boton Filtros.
Ver tambien: [[informes]]

## Errores y dudas comunes
- Si se ingresan fechas manuales y la fecha inicial es mayor a la final, aparece el mensaje: Las fechas van como 2026-10-15 y la inicial no puede ser despues de la final. Corrija las fechas para actualizar la informacion.
- Si ingresa un usuario con rol operativo (cajero, cocina o repartidor), no vera los graficos de ventas globales, sino contadores especificos de su labor en el turno.
- Los datos de ventas no se pueden modificar desde esta pantalla; es un panel de consulta y navegacion rapida.

## Quien puede hacerlo
- Todos los usuarios activos del sistema pueden ingresar al Escritorio.
- El Administrador puede ver el resumen financiero, KPIs globales y graficos de ventas. Los demas roles visualizan unicamente los indicadores y accesos directos propios de sus tareas operativas.
