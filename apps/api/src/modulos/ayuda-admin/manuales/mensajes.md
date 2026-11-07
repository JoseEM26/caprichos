---
modulo: mensajes
titulo: Mensajes de WhatsApp
ruta: /admin/mensajes
permiso: mensajes/ver
roles: [ADMIN, CAJERO, MOZO, SUPERVISOR]
relacionados: [caja, reclamos, clientes, cocina, repartos, reservas]
sugerencias:
  - Como respondo cuando un cliente pide hablar con una persona
  - Como valido un voucher de Yape o Plin con la lectura de IA
  - Que hago si expiro la ventana de 24 horas del chat
  - Como utilizo la funcion de pulir mensaje con IA
  - Como veo la ubicacion que me mando el cliente
  - Que pasa con el chat que el repartidor tiene abierto
---
# Mensajes de WhatsApp

## Para que sirve
Bandeja de atencion para las conversaciones de WhatsApp del negocio. Permite al equipo de caja y salon (Cajero y Mozo) atender clientes cuando el chatbot requiere asistencia humana, validar capturas de pago para [[caja]], coordinar el envio de comandas a [[cocina]], registrar posibles [[reclamos]] y fidelizar a los [[clientes]].

## Como se hace: Atender un chat que requiere ayuda humana
1. En la columna izquierda, revisar la pestana Por atender (chats con fondo naranja claro y etiqueta Requiere atencion).
2. Seleccionar la conversacion del cliente en la lista.
3. En la barra superior del chat, pulsar el boton Tomar chat para asignarse la conversacion. Si otro operador lo tenia asignado, se puede pulsar Forzar tomar chat tras confirmar la advertencia.
4. Escribir la respuesta en el campo de texto inferior y presionar la tecla Enter o pulsar Enviar.
5. Al terminar la atencion, pulsar el boton Marcar como atendido o Soltar chat para devolverlo al flujo normal.
Ver tambien: [[caja]], [[clientes]]

## Como se hace: Responder a una calificacion baja de la encuesta
1. Cuando un cliente califica la encuesta posventa con 1 o 2, llega una notificacion en la campana con el titulo Calificacion baja, el puntaje, el codigo del pedido y el nombre del cliente. Caja y administracion la ven.
2. Los administradores con alertas por WhatsApp reciben un mensaje individual con el mismo aviso (WhatsApp no envia a grupos, por eso llega uno por persona).
3. Pulsar la notificacion: abre el chat de ese cliente en esta bandeja. El chat queda para atencion de una persona y el bot ya no contesta en ese chat.
4. Leer lo que escribio el cliente y responder desde el campo inferior con Enter o el boton Enviar. Si el cliente aun no explica que paso, el chat queda esperando su mensaje.
5. Si el caso necesita seguimiento formal, registrarlo en [[reclamos]], pestana Quejas de WhatsApp.
Ver tambien: [[reclamos]], [[notificaciones]]

## Como se hace: Validar una captura de pago con lectura de IA
1. Cuando un cliente envia una foto de voucher por WhatsApp, la conversacion pasa de forma automatica a la cola Por atender para atencion humana.
2. Seleccionar el chat en estado Validar pago (fondo amarillo suave).
3. En el cuerpo del chat se visualizara la fotografia del comprobante como archivo privado seguro.
4. Justo debajo de los datos del pedido se muestra la tarjeta de lectura de IA con el semaforo de confianza: Confiable (verde), Observado (amarillo), Raro (naranja), Ilegible o Sin lectura (gris).
5. La tarjeta detalla los datos extraidos por la IA: monto, numero de operacion, billetera detectada (Yape o Plin), titular y fecha, contrastandolos contra el total del pedido. La IA solo extrae y clasifica; nunca aprueba el pago por si sola.
6. Si los datos coinciden, pulsar el boton Aprobar el pago (disponible incluso si el telefono tiene prefijo internacional 51) y confirmar la accion. El pedido quedara confirmado, pasara inmediatamente a las comandas de [[cocina]] y la foto del chat queda enlazada al pedido como prueba.
6.1. Si el chat no tiene pedido todavia (por ejemplo, cliente sin telefono o pedido aun no creado), la foto igual queda guardada en el chat y en la lista de comprobantes; al aprobar el pago desde el pedido, queda como prueba.
7. Si el comprobante no coincide, es ilegible o es fraudulento, pulsar Rechazar, indicar el motivo correspondiente y confirmar.
Despues: [[cocina]]
Ver tambien: [[caja]]

## Como se hace: mover un voucher desde el chat
En el panel de validar pago, debajo de la lectura del comprobante, pulsa "Reasignar a otro pedido" para pasarlo a otro pedido del mismo cliente con pago pendiente. Confirma con Sí. El chat se actualiza con el pedido nuevo; el pago se aprueba aparte con "Aprobar el pago".

## Como se hace: Pulir la respuesta con IA antes de enviarla
1. Escribir el borrador del mensaje en el area de texto de respuesta.
2. Pulsar el boton Pulir con IA.
3. El sistema sugerira una redaccion mas amable y profesional sin perder el sentido original.
4. Revisar la propuesta y pulsar Usar texto sugerido para colocarlo en la caja de envio.
Ver tambien: [[mensajes]]

## Como se hace: Ver la ubicacion que mando el cliente
1. Cuando el cliente comparte su ubicacion por WhatsApp, el mensaje se ve como una tarjeta con mapa, direccion aproximada y los botones Abrir en Google Maps y Copiar coordenadas.
2. En un pedido de delivery de Caja o del mozo, el boton Usar ubicacion de WhatsApp toma la ultima ubicacion enviada en las ultimas 24 horas como punto de entrega. Ver [[repartos]].
3. Si el cliente tiene un delivery reciente sin ubicacion (por confirmar, confirmado, preparando o listo), su ubicacion se asigna sola a ese pedido (el mas reciente) y recibe un mensaje con su envio. Si el pedido ya tenia ubicacion, la nueva queda como propuesta para Caja (Usar o Descartar). Si esta fuera de la zona de reparto, Caja recibe un aviso. Mientras el cliente arma un pedido con el bot, su ubicacion se usa en ese pedido y no se asigna a otro.

## Como se hace: Ver como el cliente arma un combo por WhatsApp
1. Si el combo tiene marcado "WhatsApp (bot)" en "¿Dónde aplica?" (ver [[ofertas]]), el cliente puede pedirlo en el chat: el bot dice que incluye, pide tamaño y elecciones una por una (por ejemplo "Elige tu opcion 1 de 2") y al final muestra el resumen con el total para confirmar.
2. En el chat veras esos mensajes como botones o listas. Si una parte fija se agoto, el cliente ve el aviso de plan B con las alternativas; si escribe "atras" corrige la ultima eleccion y con "cancelar" sale del pedido.
3. El pedido que llega ya trae el combo con sus partes (cada una en su area de cocina) y el stock descontado, igual que uno de la carta. Si algo se agoto justo al confirmar, el bot le ofrece elegir de nuevo esa parte sin pasar el chat a una persona.

## Como se hace: Cuando el repartidor chatea con el cliente de su pedido
1. El repartidor puede escribir al cliente de su pedido desde la app de reparto (mientras el pedido esta Listo o En camino y hasta 2 horas despues de entregado). Los mensajes aparecen aqui en la misma conversacion como "Local".
2. Si tu tienes tomado el chat, el repartidor ve "El local esta atendiendo este chat ahora. Podras escribir cuando lo suelte."; sueltalo para que pueda escribir. Si pasaron 24 horas sin respuesta del cliente, solo se puede reabrir con plantilla (ver abajo).
Ver tambien: [[repartos]]

## Como se hace: Reabrir una conversacion fuera de la ventana de 24 horas
1. Si han pasado mas de 24 horas desde el ultimo mensaje del cliente, WhatsApp bloquea el envio de texto libre.
2. En el banner de aviso inferior, pulsar el boton Reabrir conversacion con plantilla.
3. Se enviara un mensaje de plantilla oficial aprobado por WhatsApp para reiniciar la ventana de conversacion.
Ver tambien: [[mensajes]]

## Como se hace: Revisar y reenviar mensajes que no salieron
1. En la parte superior de Mensajes, pulsar la pestana Salientes. Muestra los mensajes automaticos del negocio (avisos de pedido, recordatorios y alertas al equipo) que estan en cola, enviados, fallidos o descartados.
2. Los indicadores muestran pendientes, enviando, fallidos y el retraso del mensaje mas viejo en cola. Si el retraso supera 5 minutos, aparece una franja de aviso fija arriba.
3. Por defecto se listan los fallidos. Cada tarjeta indica el destino enmascarado, el origen, el pedido, los intentos y el motivo del error.
4. Pulsar Reenviar y confirmar con Si, reenviar: el mensaje vuelve a la cola con los intentos en cero y sale en el siguiente lote.
5. Si el mensaje ya no debe salir (por ejemplo, el cliente ya fue atendido por llamada), pulsar Descartar, escribir el motivo y confirmar con Si, descartar. El mensaje no se borra: queda como Descartado con el motivo y quien lo hizo.
Ver tambien: [[caja]]

## Como se hace: Entender por que un mensaje quedo fallido
1. Un error permanente (por ejemplo, un numero invalido o una plantilla no aprobada) no se reintenta solo: queda fallido y hay que corregir el dato o descartarlo.
2. Un error temporal (falla de conexion, limite de Meta) se reintenta solo con esperas de 30 segundos, 2 minutos, 10 minutos y 1 hora. Si tras 5 intentos sigue fallando, queda fallido con la leyenda Intentos agotados.
3. Un cliente en BAJA no recibe mensajes y no genera aviso: es lo esperado.
4. Cada mensaje fallido avisa a Caja y Admin en la campana de notificaciones.
5. Si Meta acepta un mensaje y despues avisa que no lo entrego (por ejemplo el cliente cambio de numero o paso de 24 horas), el mensaje pasa de Enviado a Fallido con el motivo, avisa en la campana y se puede reenviar o descartar desde Salientes.
6. Cada fallido muestra el motivo en espanol; el codigo de Meta y el texto original los ve solo el Administrador. Un cliente que escribe baja o stop deja de recibir mensajes; escribir "no mas" ya no cuenta como baja.
7. Si el bot tiene un problema al procesar un mensaje del cliente, le responde una disculpa breve y le invita a escribir de nuevo o a pedir un asesor.

## Errores y dudas comunes
- Un pedido con pago digital no validado no aparecera en cocina hasta que su voucher sea aprobado por una persona; esto evita que se preparen pedidos sin respaldo financiero.
- La inteligencia artificial nunca aprueba ni rechaza pagos por su cuenta; el semaforo y los datos extraidos son una guia visual para que el operador decida.
- Toda imagen de comprobante que llega por WhatsApp se guarda y se analiza, aunque el cliente no tenga pedido asociado o escriba sin telefono. Si la IA no puede leerla, queda como Sin lectura y la decide una persona.
- Si Meta no entrega la imagen (mas de 5 MB o falla la descarga), Caja recibe el aviso Comprobante no recibido: pide al cliente que la reenvie.
- Si el mensaje muestra un icono rojo de error de envio, pulsar el boton Reintentar envio.
- Si el bot esta interfiriendo en una conversacion delicada, pulsar Pausar bot para detener sus respuestas automaticas en ese chat; al finalizar la consulta, pulsar Reanudar bot.
- El nombre del contacto se puede editar pulsando el icono del lapiz al costado del nombre en la cabecera.
- Un pedido de la carta virtual con Yape, Plin o transferencia y celular deja su chat en Validar pago y urgente: el cliente recibe el aviso de que un asesor gestionara el voucher, y el chat aparece aqui para que lo atiendas.

## Quien puede hacerlo
- Tienen acceso completo a los mensajes: Administrador, Cajero, Mozo y Supervisor.
- Los roles de Administrador y Cajero cuentan con el permiso vouchers/ver para visualizar la tarjeta de analisis del voucher y confirmar la aprobacion o rechazo.
- Mozos, Cocina y Repartidores no tienen acceso a esta bandeja de mensajes.
- Los avisos del pedido salen en orden (aceptado, listo, salida, llegada, entregado): si uno falla temporalmente, los siguientes del mismo pedido esperan a que se resuelva y no llegan antes.
