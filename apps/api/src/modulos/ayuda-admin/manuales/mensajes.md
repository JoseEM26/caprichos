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
  - Que hago si un mensaje mio dice No se pudo enviar
  - Como uso las plantillas de respuesta rapida en un chat
  - Como creo o edito una plantilla de respuesta para todo el equipo
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

## Como se hace: Enviar un documento al cliente (PDF, Word, Excel)
1. Abrir el chat y pulsar Tomar chat si todavia no es tuyo.
2. Pulsar el boton Documento, junto al cuadro de texto, y elegir el archivo. Se aceptan PDF, Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx), texto (txt) y csv, de hasta 16 MB. Otros archivos (programas, zip) no se pueden enviar.
3. Revisar el nombre y el tamano que aparecen y responder a la pregunta Enviar este documento a (nombre del cliente): pulsar Si, enviar o No.
4. Mientras se envia el boton dice Enviando. El documento queda en el hilo como una tarjeta con su nombre, tamano y el boton Descargar, y se registra quien lo envio.
5. Si pasaron mas de 24 horas desde el ultimo mensaje del cliente, WhatsApp no entrega documentos: primero reabre la conversacion con la plantilla (mismo aviso que con los textos).
Ver tambien: [[mensajes]]

## Que pasa cuando el cliente envia un documento
1. Si el cliente manda un PDF, Word, Excel o texto, el bot no lo lee: lo guarda en privado, responde una sola vez (como mucho una vez cada 2 minutos aunque mande varios) Recibi tu documento y pasa el chat a Por atender con una notificacion en la campana.
2. En el hilo aparece la tarjeta del documento. Pulsa Descargar para bajarlo: siempre se descarga como archivo y no se abre dentro de la pagina; abrelo en tu computadora solo si confias en el cliente.
3. Si el cliente manda un archivo de otro tipo (zip, programas) o que pesa mas de 16 MB, el bot le avisa que solo recibe PDF, Word, Excel, PowerPoint o texto y no lo guarda.
4. Si el bot estaba esperando el comprobante de un pago y llega un PDF, sigue pidiendo una foto o captura de pantalla: el voucher debe ser una imagen legible.

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

## Como se hace: Entender la factura que el bot manda sola
1. Cuando SUNAT acepta una factura, el bot manda su PDF al WhatsApp del cliente (el celular del pedido) con una linea de agradecimiento. Si el pedido no tiene celular valido, no se envia nada.
2. En el chat aparece como cualquier documento enviado, con el nombre Factura F002-000123.pdf. Se puede descargar desde ahi.
3. Si el cliente no escribio al bot en las ultimas 24 horas, el documento libre no se entrega: sale por una plantilla aprobada en Meta, y sin plantilla se reintenta unas pocas veces y se cierra. El estado de cada factura se ve en Comprobantes, Electronicos SUNAT.
Ver tambien: [[caja]]

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

## Como se hace: Marcar un chat como no visto y leer las fechas
1. Arriba de la lista, junto a Por atender, aparece el contador N sin ver. Los chats sin ver tienen una franja naranja, el nombre en negrita y la etiqueta Sin ver (mensajes nuevos del cliente) o No visto (marcado a mano).
2. Para verlos juntos, pulsar la pestana No vistos.
3. Para acordarse de volver a un chat, pulsar el boton de tres puntos de su fila y elegir Marcar como no visto, o abrir el chat y pulsar Marcar como no visto sobre la conversacion. La marca es del chat: la ve todo el equipo.
4. La marca no se quita sola al abrir la lista: se quita al abrir ese chat o al elegir Marcar como visto en el menu de la fila.
5. Dentro del chat, una franja con el dia (Hoy, Ayer, o Martes 3 de noviembre) separa los mensajes de cada dia, y cada mensaje muestra su hora. Al pasar el cursor o tocar la hora se ve la fecha completa, por ejemplo 3 nov 2026, 15:37.
6. En la lista, el ultimo mensaje muestra la hora si es de hoy, Ayer, el dia de la semana si es de esta semana, o la fecha como 03/11/26 si es mas antiguo. Todo en hora de Lima.
Ver tambien: [[caja]]

## Errores y dudas comunes
- Un pedido con pago digital no validado no aparecera en cocina hasta que su voucher sea aprobado por una persona; esto evita que se preparen pedidos sin respaldo financiero.
- La inteligencia artificial nunca aprueba ni rechaza pagos por su cuenta; el semaforo y los datos extraidos son una guia visual para que el operador decida.
- Toda imagen de comprobante que llega por WhatsApp se guarda y se analiza, aunque el cliente no tenga pedido asociado o escriba sin telefono. Si la IA no puede leerla, queda como Sin lectura y la decide una persona.
- Si Meta no entrega la imagen (mas de 5 MB o falla la descarga), Caja recibe el aviso Comprobante no recibido: pide al cliente que la reenvie.
- Si el mensaje muestra un icono rojo de error de envio, pulsar el boton Reintentar envio. Excepcion: si el motivo habla de las 24 horas no aparece Reintentar, porque repetir el mismo texto no sirve; usa Reabrir con plantilla.
- Cuando un chat tiene el dato "Escribio al: +51 ..." en la cabecera, ese es el numero de WhatsApp de la cuenta al que escribio el cliente. La cuenta puede tener varios numeros (por ejemplo el nuevo y el antiguo) y el bot, Caja y Mensajes siempre responden desde el mismo numero por el que escribio el cliente. Las 24 horas de WhatsApp se cuentan por numero: si el motivo dice que el cliente no le ha escrito a este numero en las ultimas 24 horas, es posible que haya escrito a otro numero de la cuenta; espera a que el bot responda desde ese o usa Reabrir con plantilla.
- Un mensaje del equipo o del bot que no muestra estado de envio no es un envio de prueba: Modo simulado solo aparece cuando la cuenta de WhatsApp no esta conectada (faltan sus credenciales).
- Si el bot esta interfiriendo en una conversacion delicada, pulsar Pausar bot para detener sus respuestas automaticas en ese chat; al finalizar la consulta, pulsar Reanudar bot.
- El nombre del contacto se puede editar pulsando el icono del lapiz al costado del nombre en la cabecera.
- Un pedido de la carta virtual con Yape, Plin o transferencia y celular deja su chat en Validar pago y urgente: el cliente recibe el aviso de que un asesor gestionara el voucher, y el chat aparece aqui para que lo atiendas.

- Al abrir un chat largo se ven los ultimos mensajes; para leer lo anterior pulsar Cargar mensajes anteriores, arriba de la conversacion. Asi el chat abre rapido aunque tenga cientos de mensajes. Las fotos y notas de voz se descargan cuando llegan a la pantalla.
- Al enviar un mensaje aparece de inmediato con la palabra Enviando; el sistema habla con WhatsApp por detras y, cuando lo recibe, pasa a Enviado con una marca de visto (y luego Entregado o Leido). Puedes seguir escribiendo sin esperar. Apretar Enviar dos veces seguidas no manda el mensaje dos veces.
- Si el mensaje no sale, queda en la conversacion con el aviso No se pudo enviar y el motivo, y el boton Reintentar. Reintentar vuelve a mandar ESE mismo mensaje (no crea otro) y respeta la ventana de 24 horas. El sistema solo reintenta solo cuando Meta rechazo el mensaje por limite o fallo suyo (hasta 3 intentos); si no hubo respuesta de Meta no lo repite solo, porque podria llegar duplicado al cliente.
- Si el aviso dice No se pudo confirmar el envio, el servidor se reinicio justo mientras enviaba y no se sabe si el cliente lo recibio: revisa en WhatsApp antes de pulsar Reintentar para no mandarlo dos veces.
- Una validacion como ventana de 24 horas cerrada, chat tomado por otra persona, numero bloqueado o limite de 20 mensajes por minuto avisa al instante, antes de enviar, y el mensaje no se guarda. Las fotos, documentos y notas de voz siguen enviandose en el momento (con su barra de espera).
- La lista de chats carga de 40 en 40: al final aparece Cargar mas chats. Los numeros de las pestanas, la busqueda y los filtros por dia cuentan y buscan en todos los chats, no solo en los cargados. Si llega un mensaje de un chat que aun no cargaste y por su hora le toca ir arriba, aparece solo; si le toca mas abajo, lo veras al pulsar Cargar mas chats.

## Como se hace: Responder rapido con una plantilla
1. Abrir el chat (con el chat tomado) y pulsar el boton Plantillas, el del rayo, junto al cuadro de texto. Tambien puedes escribir una barra / al inicio y el nombre (por ejemplo /yape): aparecen sugerencias; con las flechas eliges y con Enter la insertas.
2. Buscar por palabra en el buscador o tocar un chip de categoria: Pagos, Horarios, Ubicacion, Delivery, Pedidos, Saludo, Cierre u Otros. Cada plantilla muestra una vista previa del texto ya completado.
3. Tocar la plantilla: el texto se escribe en el cuadro de mensaje (si ya habia algo, se agrega donde esta el cursor). NO se envia sola: revisalo, cambia lo que haga falta y envialo tu con Enter o el boton Enviar.
4. Los datos se completan solos: {{nombre}} (nombre del cliente de este chat), {{mi_nombre}} (tu nombre), {{local}}, {{direccion}}, {{horario}} y los medios de pago ({{medios_pago}}, {{yape}}, {{plin}}, {{transferencia}}), que salen de Configuracion (Datos del local, Horario y Pagos): no se escriben a mano en las plantillas.
5. Si un dato no existe (por ejemplo el chat no tiene nombre, solo numero, o el medio de pago esta apagado), el marcador entre llaves queda visible y aparece el aviso Falta completar a mano. El sistema NO deja enviar el mensaje mientras quede un marcador {{...}}: escribe el dato y envia.
Ver tambien: [[mirest]]

## Como se hace: Crear, editar, pausar o borrar plantillas
1. En el panel Plantillas pulsar Administrar plantillas. Se abre una sola ventana con dos pestanas: Plantillas (la lista) y Nueva o Editar (el formulario).
2. Nueva plantilla: escribir el titulo (unico, hasta 60 letras), elegir la categoria y escribir el texto (hasta 1000 letras). Los botones de datos automaticos insertan la variable donde esta el cursor. Abajo se ve la vista previa con un cliente de ejemplo. Pulsar Guardar.
3. En la lista: las flechas suben y bajan el orden en que aparecen en el chat; Editar cambia titulo, categoria o texto; Pausar la oculta del chat sin borrarla (Activar la devuelve); Duplicar crea una copia pausada para que la ajustes; Borrar pide confirmar con Si, borrar o No en la misma fila.
4. Las plantillas son las mismas para todo el equipo: lo que alguien crea o cambia lo ven todos. Cada cambio queda en el historial (quien, cuando y que).
5. Vienen precargadas unas 20 de ejemplo (saludo, medios de pago, Yape, Plin, transferencia, horario, ubicacion, delivery, pedido recibido, en preparacion, listo, agotado, disculpa, gracias). Puedes cambiarlas o borrarlas.
Importante: las plantillas rapidas NO son las plantillas de Meta. Son texto libre que solo se puede enviar dentro de las 24 horas desde el ultimo mensaje del cliente (igual que cualquier mensaje escrito); no necesitan aprobacion de Meta. Para escribir al cliente pasadas las 24 horas se usa la plantilla de Meta que reabre la conversacion (Reabrir con plantilla).
Ver tambien: [[mensajes]]

## Quien puede hacerlo
- Usar las plantillas en un chat: quien puede ver mensajes (permiso mensajes/ver). Crear, editar, pausar, ordenar y borrar: quien puede responder chats (permiso mensajes/enviar); no hay un permiso aparte.
- Tienen acceso completo a los mensajes: Administrador, Cajero, Mozo y Supervisor.
- Los roles de Administrador y Cajero cuentan con el permiso vouchers/ver para visualizar la tarjeta de analisis del voucher y confirmar la aprobacion o rechazo.
- Mozos, Cocina y Repartidores no tienen acceso a esta bandeja de mensajes.
- Los avisos del pedido salen en orden (aceptado, listo, salida, llegada, entregado): si uno falla temporalmente, los siguientes del mismo pedido esperan a que se resuelva y no llegan antes.
- Aviso por correo de chat sin responder: si un chat esta en Por atender o Validar pago y el ultimo mensaje es del cliente (nadie le respondio, ni persona ni bot) y pasan 15 minutos, el administrador y quienes reciben avisos por correo reciben UN correo con el nombre (o el telefono oculto), cuanto espera, el ultimo mensaje y un enlace que abre este chat. Solo dentro del horario del local; al abrir llega un solo correo con los que quedaron esperando. Se maneja en Configuracion, Correos de aviso.
