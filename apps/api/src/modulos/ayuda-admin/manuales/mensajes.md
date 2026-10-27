---
modulo: mensajes
titulo: Mensajes de WhatsApp
ruta: /admin/mensajes
permiso: mensajes/ver
roles: [ADMIN, CALLCENTER]
relacionados: [caja, reclamos, clientes]
sugerencias:
  - Como respondo cuando un cliente pide hablar con una persona
  - Como apruebo o rechazo un pago enviado por WhatsApp
  - Que hago si expiro la ventana de 24 horas del chat
  - Como utilizo la funcion de pulir mensaje con IA
---
# Mensajes de WhatsApp

## Para que sirve
Bandeja de atencion para las conversaciones de WhatsApp del negocio. Permite al equipo de call center atender clientes cuando el chatbot requiere asistencia humana, validar capturas de pago para [[caja]], registrar posibles [[reclamos]] y fidelizar a los [[clientes]].

## Como se hace: Atender un chat que requiere ayuda humana
1. En la columna izquierda, revisar la pestana Por atender (chats con fondo naranja claro y etiqueta Requiere atencion).
2. Seleccionar la conversacion del cliente en la lista.
3. En la barra superior del chat, pulsar el boton Tomar chat para asignarse la conversacion. Si otro operador lo tenia asignado, se puede pulsar Forzar tomar chat tras confirmar la advertencia.
4. Escribir la respuesta en el campo de texto inferior y presionar la tecla Enter o pulsar Enviar.
5. Al terminar la atencion, pulsar el boton Marcar como atendido o Soltar chat para devolverlo al flujo normal.
Ver tambien: [[caja]], [[clientes]]

## Como se hace: Validar una captura de pago
1. Seleccionar un chat en estado Validar pago (fondo amarillo suave).
2. Revisar la imagen del comprobante de transferencia o billetera digital enviada por el cliente.
3. Si el monto y numero de operacion coinciden, pulsar el boton Aprobar pago y confirmar con Si, aprobar en el mensaje de confirmacion. El bot continuara con la confirmacion del pedido en [[caja]].
4. Si el comprobante es falso o incorrecto, pulsar Rechazar pago, ingresar el motivo y confirmar con Si, rechazar.
Despues: [[caja]]

## Como se hace: Pulir la respuesta con IA antes de enviarla
1. Escribir el borrador del mensaje en el area de texto de respuesta.
2. Pulsar el boton Pulir con IA.
3. El sistema sugerira una redaccion mas amable y profesional sin perder el sentido original.
4. Revisar la propuesta y pulsar Usar texto sugerido para colocarlo en la caja de envio.
Ver tambien: [[mensajes]]

## Como se hace: Reabrir una conversacion fuera de la ventana de 24 horas
1. Si han pasado mas de 24 horas desde el ultimo mensaje del cliente, WhatsApp bloquea el envio de texto libre.
2. En el banner de aviso inferior, pulsar el boton Reabrir conversacion con plantilla.
3. Se enviara un mensaje de plantilla oficial aprobado por WhatsApp para reiniciar la ventana de conversacion.
Ver tambien: [[mensajes]]

## Errores y dudas comunes
- Si el mensaje muestra un icono rojo de error de envio, pulsar el boton Reintentar envio.
- Si el bot esta interfiriendo en una conversacion delicada, pulsar Pausar bot para detener sus respuestas automaticas en ese chat; al finalizar la consulta, pulsar Reanudar bot.
- El nombre del contacto se puede editar pulsando el icono del lapiz al costado del nombre en la cabecera.

## Quien puede hacerlo
- Tienen acceso completo a los mensajes: Administrador y Call Center.
- Cajeros, Mozos, Cocina y Repartidores no tienen acceso a esta bandeja de mensajes.
