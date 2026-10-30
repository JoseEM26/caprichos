---
modulo: reservas
titulo: Reservas
ruta: /admin/reservas
permiso: reservas/ver
roles: [ADMIN, MOZO, CALLCENTER]
relacionados: [plano, caja, clientes, mensajes]
sugerencias:
  - Como registro una reserva de mesa por telefono o presencial
  - Como apruebo una solicitud de reserva que llego por WhatsApp
  - Como paso a los clientes a su mesa cuando llegan al local
  - Como cancelo una reserva si el cliente avisa que no asistira
---
# Reservas

## Para que sirve
Control y organizacion del libro de reservas del salon. Administra la agenda de fechas y horarios, la asignacion de mesas en base a la distribucion del [[plano]], la aprobacion de solicitudes recibidas por [[mensajes]] de WhatsApp y el enlace a [[clientes]] y [[caja]].

## Como se hace: Crear una nueva reserva
1. En la parte superior de la pantalla, pulsar el boton + Nueva reserva.
2. Seleccionar la Fecha en el calendario y la Hora estimada de llegada.
3. Indicar el Numero de personas.
4. Completar los datos del cliente vinculados a [[clientes]]: Nombre completo y Telefono de contacto.
5. Elegir la Mesa asignada entre las mesas disponibles del [[plano]] con capacidad adecuada.
6. Opcionalmente agregar Notas especiales (como celebracion de cumpleanos o silla para bebe).
7. Pulsar el boton Guardar reserva.
Antes: [[plano]]
Ver tambien: [[clientes]]

## Como se hace: Aprobar o rechazar solicitudes de WhatsApp
1. En la seccion superior Solicitudes por WhatsApp provenientes de [[mensajes]], revisar las peticiones pendientes con datos de cliente, fecha, hora y comensales.
2. Para aprobar: pulsar el boton Aprobar. Si no tiene mesa preseleccionada, se abrira el selector para asignar la mesa fisica en el [[plano]].
3. Aparecera la ventana de confirmacion con la pregunta ¿Aprobar solicitud de reserva?. Pulsar Si, aprobar. El bot notificara la confirmacion al cliente.
4. Para rechazar: pulsar el boton Rechazar, indicar el motivo si corresponde y confirmar con Si, rechazar.
Antes: [[mensajes]]
Ver tambien: [[plano]]

## Como se hace: Sentar a los clientes al llegar al local
1. En la agenda del dia o lista de reservas, ubicar al cliente al momento de su llegada.
2. Pulsar el boton Sentar clientes.
3. Aparecera la confirmacion: ¿Marcar reserva como sentada?. Pulsar Si, confirmar.
4. La mesa pasara a estado Ocupada en el [[plano]] y se abrira la pantalla para tomar la comanda inicial de la mesa en [[caja]].
Antes: [[reservas]]
Despues: [[caja]]
Ver tambien: [[plano]]

## Como se hace: Cancelar una reserva
1. Ubicar la reserva en la lista o calendario.
2. Pulsar el boton Cancelar reserva.
3. En el mensaje de confirmacion ¿Cancelar reserva?, pulsar Si, cancelar. La mesa asignada en el [[plano]] quedara liberada de inmediato para otros comensales.
Ver tambien: [[plano]]

## Errores y dudas comunes
- El sistema no permite agendar dos reservas en la misma mesa a la misma hora para evitar sobreventa.
- Se puede filtrar las reservas por fecha navegando en el calendario mensual y pulsando el dia deseado.
- Si los clientes llegan con mas personas de las reservadas, se debe editar la reserva para reasignar una mesa mas grande o juntar mesas si el plano lo permite.

## Quien puede hacerlo
- Administrador, Mozos y Call Center tienen autorizacion para ver, registrar, editar y gestionar reservas.
- Cajeros, Repartidores y Cocina no tienen acceso a este modulo.
