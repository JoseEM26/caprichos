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
  - Como rindo el dinero en efectivo de las entregas
---
# Repartos

## Para que sirve
Modulo de asignacion, enrutamiento y seguimiento de pedidos a domicilio. Cuenta con mapa en tiempo real delimitado por [[zonas]], optimizador de rutas con pedidos preparados en [[cocina]], control de cobranzas para [[caja]] y rendicion en [[cierre]].

Para el rol **REPARTIDOR**, el sistema activa automaticamente una interfaz **mobile-first** adaptada a celulares con aislamiento estricto de informacion y proteccion de datos personales. Para Administradores y Cajeros, mantiene el panel global de despacho y mapa integral.

## Reglas de aislamiento y seguridad para REPARTIDOR
1. **Aislamiento en servidor**: Cada repartidor cuenta con su propio usuario y ve exclusivamente sus propios pedidos asignados (`repartidor_party_id = su party`). Consultar o intentar modificar pedidos ajenos es rechazado con error 403 NO_ASIGNADO.
2. **Proteccion del telefono**: En los pedidos disponibles para elegir, el telefono completo del cliente permanece oculto (`null`). Solo se revela tras tomar el pedido formalmente.
3. **Tope de pedidos activos**: Un repartidor no puede superar el maximo configurable de pedidos simultaneos (parametro `rep_max_pedidos`, por defecto 5).

## Vista de Repartidor (Mobile-First)

### 1. Pestana "Mi ruta"
- Lista los pedidos asignados al repartidor ordenados por la ruta optima calculada.
- Muestra datos de entrega: codigo, direccion exacta, referencia, zona, cantidad de productos, monto a cobrar y metodo de pago.
- Canales de comunicacion directa: botones para llamada telefonica directa y enlace a WhatsApp (telefono visible tras la asignacion).
- Enlaces de navegacion directa en Google Maps y Waze con las coordenadas del cliente.
- Botones de accion grandes (minimo 48 px de alto) con confirmacion obligatoria Si/No (nunca alert o confirm nativos del navegador):
  - **Salir a reparto**: cambia el pedido a "En camino" y registra la hora de salida.
  - **Llegue a destino**: registra el arribo al domicilio del cliente.
  - **Entregar pedido**: marca el pedido como ENTREGADO y registra la hora de entrega. Recuerda si hay cobro en efectivo pendiente.
  - **Reportar problema**: abre el modal de registro de incidencias con motivo y evidencias.

### 2. Pestana "Para elegir" (Ruta sugerida y seleccion parcial)
- Muestra los pedidos listos preparados por [[cocina]] que aun no tienen repartidor asignado.
- Presenta una ruta sugerida con hasta el tope configurable de pedidos (por defecto 5).
- Muestra informacion esencial: codigo, zona, direccion aproximada, referencia, productos, metodo de pago y minutos de espera. El telefono del cliente se mantiene oculto.
- **Seleccion parcial**: El repartidor puede elegir libremente la cantidad de pedidos que desea tomar (1, 2, 3 hasta su cupo disponible).
- **Recalculo dinamico**: Al marcar o desmarcar pedidos, el sistema recalcula en tiempo real el orden optimo de paradas, la distancia estimada en kilometros y la duracion aproximada en minutos.
- **Toma atomica**: Al pulsar "Tomar seleccionados e Iniciar Ruta" y confirmar con Si/No, el servidor reserva las ordenes en una transaccion con bloqueo pesimista. Si otro repartidor gana un pedido simultaneamente, el sistema notifica claramente cual orden se perdio sin interrumpir las ordenes tomadas exitosamente.

### 3. Pestana "Hechos hoy" (Liquidacion y control)
- Muestra el historial de entregas completadas por el repartidor durante la jornada actual.
- **Tarjeta de liquidacion**: Consolida el total de entregas efectuadas y suma el **Total cobrado en efectivo para liquidar**, facilitando la rendicion de cuentas en [[caja]] al finalizar el turno.

## Vista de Administrador y Cajero (Panel de Despacho)
- Permite visualizar en el mapa todos los pedidos de la jornada, su ubicacion geoespacial por [[zonas]] y su estado de espera.
- Permite asignar o reasignar manualmente pedidos a cualquier repartidor activo.
- Permite liberar pedidos asignados en caso de averia o demora del motorizado.
- Permite resolver incidentes reportados (reprogramar, retornar al local o cobrar con recargo) y liquidar cuentas.
- **Reenvío tras el retiro (Por reprogramar)**: si el cliente dijo SÍ, el pedido aparece como Por reprogramar con el botón «Reprogramar / Reenviar a reparto: S/ x». Ese monto es el mismo que el cliente vio antes de responder y se suma una vez al total y al envío. Si el pedido ya estaba pagado, el recargo se cobra aparte en Caja (Caja recibe un aviso). El costo se configura en Configuración > Parámetros de operación, en «Costo de volver a enviar un pedido».

## Como se hace: Reportar una falla en la entrega (no contesta o direccion erronea)
1. Si transcurren varios minutos sin poder contactar al cliente, pulsar el boton Reportar problema.
2. Seleccionar el motivo: No contesta o Direccion no encontrada.
3. Registrar los intentos de contacto realizados mediante llamada telefonica y notificaciones de [[mensajes]].
4. Opcionalmente adjuntar una fotografia de la fachada o comprobante del intento de entrega.
5. Pulsar Reportar entrega fallida. El incidente se notificara a la central y a caja para coordinar la solucion.
Ver tambien: [[mensajes]]

## Errores y dudas comunes
- Si otro repartidor tomo antes un pedido de la ruta sugerida, el sistema avisa cual se perdio y conserva los demas que elegiste.
- Si llegas al tope de pedidos simultaneos (5 por defecto, se cambia en Configuracion), debes entregar alguno antes de tomar otro.
- Un repartidor solo ve sus propios pedidos; el telefono completo del cliente aparece despues de tomar el pedido.

## Quien puede hacerlo
- **Repartidores**: acceder a la vista mobile-first, elegir pedidos de la ruta sugerida, gestionar sus viajes (Salir, Llegue, Entregar), consultar telefonos de pedidos propios asignados y reportar incidentes de entrega.
- **Administrador y Cajero**: supervisar el mapa global de despacho, asignar/reasignar pedidos, resolver incidentes reportados y liquidar cuentas.
