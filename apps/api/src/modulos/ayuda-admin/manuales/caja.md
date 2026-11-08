---
modulo: caja
titulo: Pedidos y caja
ruta: /admin/caja
permiso: caja/ver
roles: [ADMIN, CAJERO, SUPERVISOR]
relacionados: [cierre, cocina, comprobantes, repartos, plano, mensajes, propinas, informes, apertura]
sugerencias:
  - Como abro la caja al iniciar mi turno
  - Como cobro un pedido y registro el vuelto
  - Por que un pedido con pago digital no aparece en cocina
  - Como anulo un pedido que el cliente cancelo
  - Como doy una cortesia a un cliente
  - Como cambio la ubicacion de un pedido de delivery
  - Que significa Direccion editada o #7 del dia
  - El repartidor pidio cambiar la forma de pago, como lo valido
---
# Pedidos y caja

## Para que sirve
Modulo central para la recepcion, seguimiento y cobro de pedidos en salon, para llevar y a domicilio. Conecta la preparacion en [[cocina]], la atencion de comprobantes en [[mensajes]], la entrega por [[repartos]], la emision de [[comprobantes]] y el balance final en [[cierre]].

## Como se hace: Abrir la caja del turno
1. En la barra superior, pulsar el boton Abrir caja.
2. En el campo Monto inicial en soles ya aparece el monto oficial que configura el administrador (Configuracion > Parametros del sistema > Caja > Monto inicial de la caja). Si es el correcto, no se toca.
3. Si hay que abrir con otro monto, se escribe el nuevo monto: no se pide ningun codigo y la auditoria marca que fue distinto del oficial.
4. Pulsar el boton Abrir caja ahora. El estado de la barra superior cambiara a Caja abierta.
Despues: [[caja]]

## Como se hace: Regla de caja abierta
1. Los pedidos entran siempre, por la carta, WhatsApp o el mozo. Aceptar un pedido y mandarlo a cocina no necesitan la caja abierta.
2. Cobrar un pedido y aprobar un pago (Aprobar el pago en Mensajes, confirmar el pago en Pedidos y Marcar coordinado) solo se pueden con la caja de hoy abierta. Con la caja cerrada, el sistema muestra "La caja está cerrada. Abre caja para cobrar y aprobar pagos.".
3. Mientras la caja este cerrada, una franja roja arriba de Pedidos y caja, Caja y cierres y Mensajes lo recuerda, con el boton Abrir caja (lleva a Caja y cierres). Los pedidos sin cobrar muestran la etiqueta Caja cerrada; el estado del pedido no cambia.
4. Cada dia, si el local ya abrio hace 15 minutos y la caja no se ha abierto, la campana avisa "Caja sin abrir" una sola vez para Caja. Los dias cerrados o feriados no avisan. Los minutos se cambian con el parametro caja_aviso_apertura_min.

## Como se hace: mover un voucher al pedido correcto
1. Si el comprobante de un cliente quedó ligado a otro de sus pedidos (la regla automática toma el pedido pendiente más reciente), abre el pedido en Confirmar pago o el chat en Mensajes.
2. En la foto del comprobante, pulsa "Reasignar a otro pedido". Solo aparecen los pedidos del mismo cliente que esperan pago digital.
3. Elige el pedido y pulsa "Mover voucher". Confirma con "Sí, mover voucher". Verás de qué pedido a cuál pasa.
4. Solo se mueve la foto: el pago se aprueba aparte. Un voucher que ya aprobó un pago no se puede mover.

## Como se hace: Cobrar un pedido
1. En la lista de pedidos (cada tarjeta muestra grande el nombre del cliente y, al lado, la modalidad con su icono: moto para Delivery, bolsa para Para llevar, mesa o En el local) o desde la pestana Por confirmar o Pago por coordinar, ubicar el pedido y pulsar el boton Cobrar.
2. Seleccionar el medio de pago: Efectivo, Yape, Plin, Tarjeta o Transferencia.
3. Si el medio es efectivo, ingresar el monto recibido en el campo Recibido para que la pantalla calcule el vuelto exacto. Tambien se pueden combinar multiples medios de pago si el cliente divide la cuenta.
4. Pulsar el boton Confirmar cobro para finalizar.
Antes: [[cocina]]
Despues: [[comprobantes]]
Ver tambien: [[cierre]]

## Como se hace: Aplicar un cupon en un pedido nuevo
1. En Nuevo pedido (de Caja o del mozo), pulsar Cupon, escribir el codigo y pulsar Aplicar. El sistema lo valida con las mismas reglas de la carta (vigencia, horario, compra minima, usos y acumulacion con promociones) y muestra el descuento en el resumen.
2. Si no sirve, aparece el motivo en claro: no existe, vencido, ya canjeado, compra minima no alcanzada, sin usos disponibles o ya hay una promocion con mayor descuento. Solo valida: el cupon se gasta al registrar el pedido y no se puede usar dos veces.
3. Si se cambian los productos despues de aplicarlo, el cupon se quita y hay que aplicarlo otra vez. Quitar lo deja sin descuento. Pueden hacerlo Administrador, Cajero, Mozo y Supervisor.

## Como se hace: Adjuntar la foto del comprobante al cobrar
1. Al elegir Yape, Plin o Transferencia aparece la seccion Comprobante del pago digital. Tomar la foto del voucher con la camara o subir el archivo; la imagen se reduce en el navegador y se guarda como archivo privado, como prueba.
2. Al terminar la subida, la pantalla muestra la lectura de la IA: semaforo, motivos y datos extraidos (monto, operacion, billetera, titular y fecha) comparados con el total. La lectura es informativa y la decision es de la persona de caja, pero una foto que la IA marca como ILEGIBLE no cuenta como comprobante: la pantalla avisa "No se lee: sube otra foto o confirma sin comprobante" (con el motivo).
3. Con la foto guardada, el boton Registrar cobro queda activo. Confirmar con Cobrar.
4. Excepcion: si de verdad no hay foto, o la foto no se lee, pulsar No hay foto: registrar sin voucher. Escribir el motivo (minimo 5 letras); no se pide codigo. La excepcion queda auditada con el motivo y quien la registro. El mozo no tiene esta excepcion: si no hay foto legible, la deja pendiente y Caja decide.
5. Pago coordinado: en Pedidos por coordinar, Marcar coordinado con Yape, Plin o Transferencia pide la misma foto (o la excepcion con motivo). Efectivo y tarjeta se marcan sin foto. Sí, marcar confirma la accion.
6. La seccion Comprobantes muestra todas las fotos asociadas a la cuenta (de mozo, caja, WhatsApp o la carta), con su lectura. Pulsa la foto para verla en grande.
7. Si el mozo ya subio la foto del voucher de una mesa, el cobro la muestra al abrir Registrar cobro: se cobra con esa foto (con su semaforo) sin subir otra. Si no sirve, pulsa Subir otra foto.
8. Cobro de mesa enviado por el mozo: la campana avisa "Voucher del mozo por revisar" o "Pago en efectivo del mozo" y el enlace abre el pedido directamente. El mozo no cobra: Caja revisa la foto y registra el cobro.
Antes: [[cocina]]
Despues: [[comprobantes]]
Ver tambien: [[cierre]]

## Como se hace: Controlar pedidos con pago digital y pase a cocina
1. Cuando un cliente solicita un pedido pagando con billetera digital (Yape o Plin) desde la carta web o el chatbot, el pedido entra con estado de pago pendiente de validacion.
2. Por regla estricta del negocio, ningun pedido con pago digital sin validar aparece en las pantallas de [[cocina]], protegiendo la produccion contra pedidos no confirmados.
3. En la pestana Por confirmar o desde la bandeja de [[mensajes]], revisar la tarjeta de lectura de IA del voucher y verificar los datos bancarios.
4. Al pulsar Aprobar el pago en [[mensajes]] o al completarse el cobro del voucher en [[plano]], el pedido queda validado y se dispara automaticamente la comanda hacia [[cocina]].
5. Si el pago es rechazado, el pedido no llega a cocina y se notifica al cliente para que subsane el pago.
Antes: [[mensajes]]
Despues: [[cocina]]
Ver tambien: [[cierre]]

## Como se hace: Anular un pedido o un cobro
1. Solo Caja o el Administrador anulan pedidos (ni cocina, ni mozo, ni supervisor). Abrir el pedido que se desea anular y pulsar el boton Anular pedido (o Anular cobro si ya fue cobrado).
2. Seleccionar uno de los motivos rapidos (Cliente no recibio, Pedido duplicado, El cliente desistio, Error al digitar, Falta un insumo, No contesta) o escribir el motivo con al menos 5 caracteres.
3. Pulsar el boton Continuar. No se pide ningun codigo de supervisor.
4. En la ventana de confirmacion con la pregunta ¿Confirmas anular el pedido?, pulsar Si, anular.
Ver tambien: [[historial]]

## Como se hace: Crear un pedido directo en mesa o mostrador
1. Pulsar el boton + Pedido en mesa ubicado en la cabecera.
2. Seleccionar la mesa en base al [[plano]] o indicar la modalidad Para llevar.
3. Elegir los productos y opciones del catalogo.
4. Indicar los datos del cliente y comprobante si lo solicita.
5. Pulsar Enviar a cocina o Cobrar directamente.
Antes: [[plano]]
Despues: [[cocina]]

## Como se hace: Revisar los pedidos no entregados (delivery)
1. Pulsar la pestana No entregados en la barra de pestanas. El contador indica cuantos pedidos de delivery no llegaron al cliente.
2. Por reprogramar: el repartidor se retiro por espera agotada y el pedido sigue sin repartidor. Cada fila muestra el codigo, el cliente, el telefono (pulsarlo llama), el total, el motivo, la hora del retiro y el estado de la pregunta: Esperando respuesta del cliente, Dijo que si quiere reprogramar, Dijo que no, Sin respuesta o Sin pregunta registrada.
3. Cuando el cliente dijo que si, aparece el boton Reprogramar / Reenviar a reparto. Pulsarlo, revisar el aviso y confirmar con Si, confirmar. El pedido vuelve a Para elegir con la marca Reprogramado y se avisa al cliente por WhatsApp. Ese boton solo lo ve quien puede liquidar en Repartos.
4. Cancelados por no recibir: pedidos anulados porque el cliente no quiso reprogramar, no respondio o llego al limite de reprogramaciones. El motivo queda visible. Si el pedido ya estaba pagado, aparece la marca Revisar devolucion: el sistema no devuelve dinero solo, hay que devolverlo al cliente desde caja.
5. Cualquier cambio en estos pedidos (un SI, un NO o un reenvio) actualiza la pestana sin recargar la pagina.
Ver tambien: [[repartos]]

## Como se hace: Ver y reimprimir las etiquetas de un pedido
1. Abrir el pedido y pulsar la pestana Etiquetas. Aparece una tarjeta por cada etiqueta: la general, una por area y una por cada vaso de bebida, con su vista previa.
2. Cada tarjeta muestra su estado: En cola (esperando la impresora), Imprimiendo, Impresa con la hora, Fallida con el motivo o Vencida (no se imprimio a tiempo o el pedido fue anulado).
3. Arriba se resume: cuantas etiquetas hay, cuantas estan impresas, en cola, fallidas o vencidas.
4. Para volver a imprimir una sola etiqueta, pulsar Reimprimir en su tarjeta y confirmar con Si. Para todas, usar Reimprimir todas y confirmar. Una etiqueta que ya esta en cola no se duplica.

## Como se hace: Revisar la impresora cuando no sale la etiqueta
1. Si al aceptar un pedido aparece el aviso Impresora de Caja sin conexion (campana) o la franja roja arriba de Pedidos y caja, la PC de la etiquetera no esta respondiendo. Revisar que este encendida, con el programa de impresion abierto y con sesion iniciada.
2. La franja desaparece sola cuando la impresora vuelve a conectarse. Al reconectar, las etiquetas en cola se imprimen en su orden.
3. Si las etiquetas llevan mas tiempo del configurado sin salir, los administradores reciben un aviso por WhatsApp (una vez por cada grupo de etiquetas pendientes).
4. Las etiquetas de pedidos anulados, o que llevaron demasiado tiempo en cola, quedan como Vencida y no salen solas. Si hacen falta, se reimprimen desde la pestana Etiquetas.
Ver tambien: [[cocina]]

## Como se hace: Dar una cortesia (producto a costo S/ 0)
Una cortesia es una venta a costo 0: no suma ingresos, no sale en comprobantes (SUNAT y PDF) ni da puntos, y no cuenta como merma. Descuenta stock como una venta y queda registrada con su motivo y su valor de lista.
1. Dentro de un pedido que aun no esta cobrado ni tiene descuento: abre el pedido, en la linea del producto pulsa Dar como cortesia. Tambien se puede al armar el pedido en el local (+ Pedido en mesa), en la linea del pedido.
2. En la ventana "Dar como cortesia: [producto]" elige el Motivo (obligatorio): Compensacion por error o demora, Cumpleanos o cliente frecuente, Degustacion o promocion, Reclamo del cliente u Otro. Con Otro la Nota es obligatoria; en los demas es opcional (hasta 300 letras).
3. Pulsa Dar cortesia. La linea queda en S/ 0 con la etiqueta "Cortesia · vale S/ N". Quitar cortesia (solo mientras se arma el pedido) la devuelve a su precio.
4. Por separado: si el pedido ya esta cobrado, tiene descuento o es una cortesia aparte, pulsa Registrar cortesia (cabecera de Pedidos y caja). Se abre un asistente de 3 pasos, con Siguiente y Atras:
   - Paso 1, "Que regalas?": escribe en "Escribe para buscar un producto" o filtra por las categorias (chips); los agotados salen marcados Agotado y se ve "Quedan N". Elige el producto y, si lo pide, el Tamano o el Sabor, y la Cantidad (minimo 1). Avisos: "Elige el producto.", "Elige el tamano del producto.", "Elige el sabor que se regala.", "La cantidad minima es 1.".
   - Paso 2, "Por que?": elige el Motivo (obligatorio) y la Nota (obligatoria si es Otro).
   - Paso 3, "A que pedido corresponde?": el pedido de referencia es obligatorio. Al hacer clic en el campo aparecen los 12 pedidos mas recientes; filtra escribiendo "Busca por codigo (CP-...), cliente o mesa". Cada fila muestra codigo, quien, estado y total; el icono del ojito abre el detalle del pedido para confirmar que es el correcto. Si no hay: "No encontramos pedidos con ese dato.". Debajo aparece el Resumen (Regalas, Motivo, Pedido). Pulsa Registrar cortesia.
5. Quien la da: Caja, Administrador y Supervisor la dan directo, sin ningun codigo; queda registrado quien la dio. El mozo no puede dar cortesias: la pide a Caja.
6. No se pueden marcar como cortesia las lineas de combos o promociones.
7. Informe: en Informes, reporte Cortesias (por motivo, por producto y por quien la dio, con valor de lista).
Ver tambien: [[informes]]

## Como se hace: Cambiar la ubicacion de un pedido de delivery
1. Abre el pedido de delivery. En la seccion de ubicacion pulsa Cambiar ubicacion, mueve el pin o busca la direccion (o usa Usar ubicacion de WhatsApp si el cliente la envio en las ultimas 24 h). Funciona igual en un pedido que llego sin ubicacion.
2. Revisa la comparacion Antes y Despues: zona, Envio, Diferencia y Total. Pulsa Cambiar y confirma "Si, cambiar".
3. Si el pedido ya estaba pagado y el envio cambio, queda un Saldo por cobrar (cobrar mas) o una Devolucion pendiente (devolver). Pulsa Cobrar saldo o Marcar como devuelta, elige el medio (si no es efectivo, el Codigo de operacion). En efectivo necesitas la caja abierta ("Abre la caja para mover efectivo").
4. El repartidor tambien puede proponer la ubicacion real: veras la propuesta con mapas, la distancia al punto actual, la diferencia de envio y los botones Aprobar o Rechazar. Si es el cliente quien envio otra ubicacion por WhatsApp, la tarjeta dice "El cliente envio otra ubicacion: usarla?" con los botones Usar o Descartar.
5. Una devolucion pendiente por cambio de ubicacion no afecta el cierre mientras no se marque como devuelta.
6. La insignia Direccion editada aparece en Caja, Repartos y Mis pedidos cuando el punto se cambio; el historial muestra quien lo cambio. No se cambia en pedidos Entregados ni Anulados.
Ver tambien: [[repartos]]

## Como se hace: Validar un cambio de forma de pago pedido por el repartidor
1. Cuando un repartidor pide cambiar el pago en la puerta (por ejemplo de efectivo a Yape), aparece el panel Cambios de pago solicitados arriba de la lista de Pedidos y caja, el pedido muestra la insignia Cambio de pago solicitado y llega una notificacion a la campana.
2. Cada solicitud muestra el Medio original contra el Medio nuevo (con "paga con" si hay efectivo), quien lo pidio y las capturas del pedido para validarlas contra el monto de cada medio.
3. Aprobar: el pedido pasa al medio nuevo (el plan de pago se reescribe), la captura queda validada y el repartidor recibe el aviso. El pedido sigue sin cobrarse hasta que registres el cobro como siempre.
4. Rechazar (motivo opcional): el pedido sigue con el medio original, las capturas del intento quedan retiradas en el historial y el repartidor cobra como estaba.
5. Autorizar entrega sin validar (motivo obligatorio, minimo 5 caracteres): el repartidor puede entregar aunque no puedas validar la captura todavia (por ejemplo, la app del banco no abre). El medio nuevo se aplica, la captura queda pendiente de revision y todo queda auditado con tu nombre y el motivo.
6. Mientras la solicitud esta pendiente el repartidor no puede marcar Entregado. Ninguna decision pide codigo: validar un pago no es anular.
7. Efecto en el dinero: el efectivo por rendir del repartidor y el cierre cuentan el medio final. Efectivo a Yape: ese pedido ya no es efectivo por rendir. Yape a efectivo: se suma a lo que el repartidor debe liquidar. Pago mixto: solo la parte en efectivo. El total del pedido nunca cambia.
8. El historial de solicitudes no se edita ni se borra.
Ver tambien: [[repartos]]

## Como se hace: Atender un delivery que espera la ubicacion del cliente
1. Desde la carta el cliente ya no marca el punto en el mapa: escribe su direccion y su referencia. El pedido queda Por confirmar con el aviso "Falta la ubicacion: el cliente debe enviarla por WhatsApp" y el envio como "Envio por confirmar".
2. El mensaje de WhatsApp al cliente ya le pide la ubicacion (clip, Ubicacion, Enviar tu ubicacion actual). Cuando la envia, el pedido se ubica solo: se calcula la zona y el envio, la pantalla se actualiza en vivo y el cliente recibe su confirmacion. No hay que copiar ni pegar nada.
3. Si el cliente no la envia, pulsa Pedir ubicacion por WhatsApp para reenviarle el pedido. Solo funciona dentro de las 24 horas desde su ultimo mensaje; si ya paso ese tiempo el sistema lo dice ("Pasaron mas de 24 h...") y debes llamarlo o esperar que escriba. Tambien puedes pulsar Ubicar en el mapa.
4. Mientras falte la ubicacion no se puede confirmar el pedido y el pago, cobrar ni pasar a cocina: el sistema responde "Para delivery primero ubica la direccion en el mapa (calcula la zona y el envio)." y los botones quedan deshabilitados.
5. Si la ubicacion del cliente cae fuera de la zona de reparto, el pedido queda marcado Fuera de zona, el cliente recibe un aviso y ves la ubicacion como propuesta que solo puedes Descartar; ubica el pedido a mano o habla con el cliente.
Ver tambien: [[repartos]], [[mensajes]]

## Como se hace: Leer las insignias #N del dia y las propinas
1. "#N del dia" en el detalle del pedido es el orden de llegada a cocina de hoy (referencial; reinicia a medianoche de Lima). El codigo CP-xxxx es el que vale. Un pedido sin numero (anterior a esta funcion) muestra un guion.
2. Si el pedido trae propina (la dejo el cliente en la carta o el bot), el cobro muestra "Venta S/ X + propina S/ Y (va aparte, no es venta)". Se cobra la suma; la propina no es ingreso ni sale en comprobantes y se ve en [[propinas]] y en el bloque de propinas del [[cierre]].

## Errores y dudas comunes
- Un pedido con pago digital (Yape o Plin) no aparecera en cocina hasta que su comprobante sea aprobado; si la cocina reclama que no ve el pedido, verifique si el voucher sigue pendiente de aprobacion en el modulo de Mensajes.
- Si el boton Registrar cobro no se activa con Yape o Plin, falta la foto del comprobante: subela, o usa la excepcion con motivo.
- Una foto que la IA marca como ilegible no cuenta como comprobante: pide otra foto al cliente o usa la excepcion con motivo. Una foto marcada como raro se guarda y se cobra; revisela con el cliente si hay dudas.
- Si un cliente escribe por WhatsApp con una imagen y no ves el comprobante en la ficha, revisa el chat en Mensajes: la foto queda guardada aunque aun no exista la cuenta.
- No se puede cerrar la caja al finalizar el dia si existen pedidos pendientes de cobro; deben cobrarse o anularse primero.
- Si no puedes cobrar o aprobar un pago y aparece "La caja está cerrada", abre la caja del dia en Caja y cierres.
- "La solicitud ya fue resuelta" (SOLICITUD_NO_VIGENTE): otra persona de Caja ya la aprobo, rechazo o autorizo; recarga la lista. "Escribe el motivo para autorizar la entrega sin validar": falta el motivo (minimo 5 caracteres). "El pedido ya esta anulado o pagado: no se puede cambiar el cobro": ya no admite el cambio.
- Si un pedido por delivery no tiene ubicacion en el mapa, no se confirma, no se cobra y no pasa a cocina (409 DELIVERY_SIN_UBICACION): usa Pedir ubicacion por WhatsApp o Ubicar en el mapa.
- Si la impresora de caja no responde, las etiquetas quedan en cola y no se pierden: la franja de Pedidos y caja lo indica. Al reconectar salen solas.

## Quien puede hacerlo
- Pueden ingresar y operar en Pedidos y caja: Administrador y Cajero.
- El Supervisor ve Pedidos y caja y puede dar cortesias, pero no cambia la ubicacion de pedidos. Si valida los cambios de forma de pago pedidos por el repartidor (pedidos/validar_cambio_cobro), igual que el Cajero y el Administrador, sin codigo. Los demas roles (Cocina, Mozo, Repartidor, Almacen) no tienen acceso a esta pantalla.
- La anulacion de pedidos y cobros ya no pide codigo de supervisor: la hace quien tiene el permiso, con motivo, y queda auditada. Cocina y Mozo anulan un pedido desde su propia pantalla (el mozo solo el que el tomo, en cola, preparando o listo y sin cobro ni voucher aprobado); un pedido ya cobrado o entregado sigue necesitando a Caja, al administrador o al supervisor.
- Errores de cortesia: "El pedido ya esta cobrado: registra la cortesia por separado", "El pedido tiene descuento: registra la cortesia por separado", "El pedido ya tiene comprobante", "Esta linea ya es cortesia", "Las lineas de combo o de promocion no se pueden marcar como cortesia", "Un pedido solo de cortesias no se puede cobrar: registra la cortesia por separado", "La cortesia deja el plan de pago por debajo de cero: rehaz el plan de pago".
