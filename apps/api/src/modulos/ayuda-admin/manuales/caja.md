---
modulo: caja
titulo: Pedidos y caja
ruta: /admin/caja
permiso: caja/ver
roles: [ADMIN, CAJERO]
relacionados: [cierre, cocina, comprobantes, repartos, plano, supervisor-codigo, mensajes]
sugerencias:
  - Como abro la caja al iniciar mi turno
  - Como cobro un pedido y registro el vuelto
  - Por que un pedido con pago digital no aparece en cocina
  - Como anulo un pedido que el cliente cancelo
  - Donde veo el pedido de delivery que no se entrego
---
# Pedidos y caja

## Para que sirve
Modulo central para la recepcion, seguimiento y cobro de pedidos en salon, para llevar y a domicilio. Conecta la preparacion en [[cocina]], la atencion de comprobantes en [[mensajes]], la entrega por [[repartos]], la emision de [[comprobantes]] y el balance final en [[cierre]].

## Como se hace: Abrir la caja del turno
1. En la barra superior, pulsar el boton Abrir caja.
2. En el campo Monto inicial en efectivo, ingresar el fondo fijo de apertura en soles.
3. Pulsar el boton Abrir caja ahora. El estado de la barra superior cambiara a Caja abierta.
Antes: [[supervisor-codigo]]
Despues: [[caja]]

## Como se hace: mover un voucher al pedido correcto
1. Si el comprobante de un cliente quedó ligado a otro de sus pedidos (la regla automática toma el pedido pendiente más reciente), abre el pedido en Confirmar pago o el chat en Mensajes.
2. En la foto del comprobante, pulsa "Reasignar a otro pedido". Solo aparecen los pedidos del mismo cliente que esperan pago digital.
3. Elige el pedido y pulsa "Mover voucher". Confirma con "Sí, mover voucher". Verás de qué pedido a cuál pasa.
4. Solo se mueve la foto: el pago se aprueba aparte. Un voucher que ya aprobó un pago no se puede mover.

## Como se hace: Cobrar un pedido
1. En la lista de pedidos o desde la pestana Por confirmar o Pago por coordinar, ubicar el pedido y pulsar el boton Cobrar.
2. Seleccionar el medio de pago: Efectivo, Yape, Plin, Tarjeta o Transferencia.
3. Si el medio es efectivo, ingresar el monto recibido en el campo Recibido para que la pantalla calcule el vuelto exacto. Tambien se pueden combinar multiples medios de pago si el cliente divide la cuenta.
4. Pulsar el boton Confirmar cobro para finalizar.
Antes: [[cocina]]
Despues: [[comprobantes]]
Ver tambien: [[cierre]]

## Como se hace: Adjuntar la foto del comprobante al cobrar
1. Al elegir Yape, Plin o Transferencia aparece la seccion Comprobante del pago digital. Tomar la foto del voucher con la camara o subir el archivo; la imagen se reduce en el navegador y se guarda como archivo privado, como prueba.
2. Al terminar la subida, la pantalla muestra la lectura de la IA: semaforo, motivos y datos extraidos (monto, operacion, billetera, titular y fecha) comparados con el total. La lectura es informativa y la decision es de la persona de caja, pero una foto que la IA marca como ILEGIBLE no cuenta como comprobante: la pantalla avisa "No se lee: sube otra foto o confirma sin comprobante con codigo del supervisor".
3. Con la foto guardada, el boton Registrar cobro queda activo. Confirmar con Cobrar.
4. Excepcion: si de verdad no hay foto, o la foto no se lee, pulsar No hay foto: registrar sin voucher (con supervisor). Escribir el motivo (minimo 5 letras) e ingresar el codigo de 6 digitos del supervisor. La excepcion queda auditada con el motivo y quien la aprobo. El mozo no tiene esta excepcion: si no hay foto legible, la deja pendiente y Caja decide.
5. Pago coordinado: en Pedidos por coordinar, Marcar coordinado con Yape, Plin o Transferencia pide la misma foto (o la excepcion con supervisor). Efectivo y tarjeta se marcan sin foto. Sí, marcar confirma la accion.
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
1. Abrir el pedido que se desea anular y pulsar el boton Anular pedido (o Anular cobro si ya fue cobrado).
2. Seleccionar uno de los motivos rapidos (Cliente no recibio, Pedido duplicado, El cliente desistio, Error al digitar, Falta un insumo, No contesta) o escribir el motivo con al menos 5 caracteres.
3. En el campo Codigo del supervisor, ingresar el codigo rotativo de 6 digitos obtenido en [[supervisor-codigo]].
4. Pulsar el boton Continuar.
5. En la ventana de confirmacion con la pregunta ¿Confirmas anular el pedido?, pulsar Si, anular.
Requiere: [[supervisor-codigo]]
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

## Errores y dudas comunes
- Un pedido con pago digital (Yape o Plin) no aparecera en cocina hasta que su comprobante sea aprobado; si la cocina reclama que no ve el pedido, verifique si el voucher sigue pendiente de aprobacion en el modulo de Mensajes.
- Si al anular se ingresa un codigo de supervisor incorrecto o vencido, aparece el mensaje: Codigo del supervisor invalido. Pídelo nuevamente a la supervisora.
- Si el boton Registrar cobro no se activa con Yape o Plin, falta la foto del comprobante: subela, o usa la excepcion con motivo y codigo del supervisor.
- Una foto que la IA marca como ilegible no cuenta como comprobante: pide otra foto al cliente o usa la excepcion con supervisor. Una foto marcada como raro se guarda y se cobra; revisela con el cliente si hay dudas.
- Si un cliente escribe por WhatsApp con una imagen y no ves el comprobante en la ficha, revisa el chat en Mensajes: la foto queda guardada aunque aun no exista la cuenta.
- No se puede cerrar la caja al finalizar el dia si existen pedidos pendientes de cobro; deben cobrarse o anularse primero.
- Si un pedido por delivery no tiene ubicacion GPS o referencia clara, debe ubicarse en el mapa antes de enviarse a despacho.
- Si la impresora de caja no responde, las etiquetas quedan en cola y no se pierden: la franja de Pedidos y caja lo indica. Al reconectar salen solas.

## Quien puede hacerlo
- Pueden ingresar y operar en Pedidos y caja: Administrador y Cajero.
- Los demas roles (Cocina, Mozo, Repartidor, Almacen) no tienen acceso a esta pantalla.
- La anulacion de pedidos y cobros requiere siempre la autorizacion con el codigo de supervisor de 6 digitos.
