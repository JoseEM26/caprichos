---
modulo: reclamos
titulo: Libro de reclamaciones
ruta: /admin/reclamos
permiso: reclamos/ver
roles: [ADMIN]
relacionados: [mensajes, caja, clientes]
sugerencias:
  - Como reviso un reclamo ingresado por un cliente
  - Como paso un reclamo al estado En revision
  - Como respondo formalmente un reclamo segun ley
  - Cual es el plazo maximo para responder un reclamo
---
# Libro de reclamaciones

## Para que sirve
Gestion del Libro de Reclamaciones virtual oficial de Caprichos y control de quejas levantadas por canales digitales como [[mensajes]] de WhatsApp. Permite rastrear pedidos de [[caja]] asociados a incidentes con [[clientes]], garantizando los plazos legales de Indecopi mediante respuestas formales auditadas.

## Como se hace: Revisar el detalle de un reclamo
1. En la pestana Libro de Reclamaciones, revisar la tabla de registros.
2. Se puede filtrar por estado (Pendientes, En revision, Respondidos) o buscar por codigo de reclamo, nombre o documento del consumidor registrado en [[clientes]].
3. Observar el semaforo de plazo: muestra los dias restantes respecto al plazo maximo de ley de 15 dias habiles.
4. Pulsar sobre el reclamo para abrir el detalle completo (datos del consumidor, tipo de reclamo o queja, producto o servicio contratado y pedido de [[caja]]).
Ver tambien: [[caja]], [[clientes]]

## Como se hace: Marcar un reclamo en revision
1. Dentro del detalle del reclamo pendiente, pulsar el boton Pasar a En revision.
2. Aparecera la ventana de confirmacion: ¿Pasar reclamo a revision?.
3. Pulsar Si, confirmar. El estado se actualizara indicando que el caso esta en investigacion interna.
Ver tambien: [[reclamos]]

## Como se hace: Responder formalmente al consumidor
1. En el expediente del reclamo, pulsar el boton Responder reclamo.
2. En el area de texto, redactar la respuesta formal con los descargos, acciones tomadas o propuesta de solucion hacia el consumidor.
3. Pulsar el boton Enviar respuesta.
4. En la ventana de confirmacion con la pregunta ¿Enviar respuesta formal al consumidor?, pulsar Si, enviar.
5. El sistema registrara la respuesta, cerrara el expediente y enviara la notificacion al correo del consumidor conforme a la normativa, registrandolo en el [[historial]].
Despues: [[historial]]
Ver tambien: [[mensajes]]

## Como se hace: Revisar quejas de WhatsApp
1. Ir a la pestana Quejas de WhatsApp en la parte superior.
2. Revisar los reportes de inconformidad detectados durante la interaccion en [[mensajes]] con el chatbot.
3. Pulsar en cada queja para consultar el chat asociado o contactar al cliente para resolver su problema.
4. Las calificaciones de 1 o 2 en la encuesta posventa llegan aqui con origen Encuesta. Cada una tambien avisa en la campana y por WhatsApp a los administradores; la conversacion se responde desde [[mensajes]].
Ver tambien: [[mensajes]]

## Errores y dudas comunes
- Una respuesta formal enviada no se puede editar ni borrar; queda archivada como constancia legal de atencion.
- Un Reclamo responde a una disconformidad sobre los productos o servicios brindados; una Queja expresa malestar respecto a la atencion recibida.
- Debe vigilarse el semaforo de dias restantes para no exceder los 15 dias habiles fijados por la autoridad competente.

## Quien puede hacerlo
- Unicamente el rol Administrador tiene permiso para ver y responder el Libro de Reclamaciones.
- Cajeros, mozos, cocina y repartidores no tienen acceso por tratarse de informacion legal y confidencial del consumidor.
