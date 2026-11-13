---
modulo: comprobantes
titulo: Comprobantes
ruta: /admin/comprobantes
permiso: comprobantes/ver
roles: [ADMIN, CAJERO]
relacionados: [caja, cierre]
sugerencias:
  - Como imprimo o reimprimo una nota de venta
  - Donde veo los pedidos que necesitan boleta o factura electronica
  - Como marco un comprobante como emitido en el facturador
  - Que datos necesito para emitir una factura
  - Que es el comprobante simple y se envia a SUNAT
  - Como se envia la factura por WhatsApp al cliente
  - A que hora se envian las boletas y facturas a SUNAT
  - Como corrijo la boleta o factura despues del cobro
---
# Comprobantes

## Para que sirve
Modulo de administracion y control de comprobantes de pago. Gestiona la reimpresion de notas de venta internas generadas en [[caja]] y la conciliacion de boletas y facturas electronicas solicitadas por los clientes hacia el facturador SUNAT, permitiendo cuadrar los reportes fiscales con el [[cierre]].

## Como se hace: Reimprimir una nota de venta
1. Ir a la pestana Nota de venta.
2. En el buscador superior, ingresar el codigo del pedido de [[caja]] o seleccionarlo desde la lista.
3. La pantalla mostrara la vista previa del ticket termico con datos de la empresa, detalle de productos, montos, descuentos y medio de pago.
4. Pulsar el boton Reimprimir nota de venta.
5. El sistema enviara la impresion a la ticketera y registrara el evento de reimpresion en la auditoria.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Como se hace: Gestionar comprobantes electronicos por emitir
1. Ir a la pestana Por emitir.
2. Aparecera la lista de pedidos pagados en [[caja]] cuyos clientes solicitaron Boleta (con DNI) o Factura (con RUC y razon social).
3. Tomar los datos fiscales que figuran en la tarjeta (numero de documento, nombre o razon social, direccion fiscal y total).
4. Emitir el comprobante en el sistema de facturacion electronica autorizado.
5. En la fila del pedido dentro de Caprichos, pulsar el boton Marcar como emitido.
6. Ingresar el numero de serie y correlativo generado por el facturador en el campo Referencia externa.
7. Pulsar Guardar para actualizar el estado a Emitido.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Como se hace: Elegir el comprobante del pedido (simple, boleta o factura)
1. En la carta virtual, en WhatsApp, en Nuevo pedido del mozo y en [[caja]] el pedido lleva uno de tres comprobantes. Por defecto es Comprobante simple.
2. Comprobante simple es el ticket interno del pedido: no pide DNI ni RUC y no se envia a SUNAT.
3. En Boleta y en Factura hay un solo campo: DNI o RUC. Escribe 8 digitos y es un DNI (boleta); escribe 11 y es un RUC (factura, y pasa sola a Factura si estabas en Boleta). Al completar los digitos el sistema busca el nombre o la razon social y la direccion fiscal; puedes corregirlos. Si dice "No encontramos" o "el servicio no esta disponible", escribe los datos a mano. La boleta lleva el DNI opcional hasta S/ 700 y obligatorio por encima. La factura exige RUC de 11 digitos y razon social. En boleta el nombre del DNI solo se muestra para que confirmes que es la persona correcta; no se guarda.
4. El DNI de la boleta se guarda solo en el pedido y en el comprobante, nunca en la cuenta del cliente. El RUC de la factura si se guarda en la cuenta del cliente (por su celular), la primera vez que pide factura. Si la cuenta ya tiene un RUC y el cliente escribe otro, ese pedido usa el que escribio y la cuenta conserva el guardado.
4b. La proxima vez que pida factura, al poner su celular el RUC, la razon social y la direccion fiscal salen puestos y se pueden corregir. En la carta el RUC guardado solo aparece si el cliente inicio sesion. En el bot de WhatsApp el cliente escribe SI para usar su RUC guardado.
5. Antes de cobrar, en el detalle del pedido pulsa Cambiar comprobante para pasar de uno a otro. Ya cobrado, mira el apartado Corregir la boleta o factura despues del cobro.
6. Solo la boleta y la factura se emiten a SUNAT y aparecen en Electronicos SUNAT; el simple no deja nada pendiente de envio.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Como se hace: Envio de boletas y facturas a SUNAT en la noche
1. Al cobrar, la boleta o la factura NO sale al instante: queda con el estado Se emite esta noche, todavia sin serie ni numero. El ticket del cobro lo dice: Boleta o Factura, se emite hoy por la noche. La factura le llega al cliente por WhatsApp cuando SUNAT la acepta.
2. Desde la hora configurada (por defecto las 23:00, hora de Lima, despues del cierre) el sistema pone serie y numero a cada una, las firma y las envia. Las boletas entran al resumen diario de SUNAT (por defecto 23:30) y las facturas se envian directo.
3. Asi un cambio del mismo dia no deja huecos de numeracion ni numeros gastados, y no hace falta anular nada.
4. El Administrador cambia las horas en Comprobantes > Electronicos SUNAT > Facturacion electronica: «Hora de boletas y facturas» (por defecto 23:00) y «Hora del resumen de boletas» (por defecto 23:30; debe ser al menos 15 minutos despues y a mas tardar 23:50). En «Cuando se emiten» puede volver a «Al cobrar». Se guarda con «Guardar configuracion» y un Si/No.
5. Boton «Emitir ahora»: emite en ese momento todo lo que espera la noche (boletas, facturas y cambios de comprobante pendientes) y envia el resumen de boletas. Lo que se cobre despues sale en la noche como siempre. Si luego se cambia el comprobante de un pedido ya emitido, se hace con una baja.
   Para emitir UNA sola, cada fila con la insignia Se emite esta noche tiene su propio boton «Emitir ahora» (con Si/No): numera y envia solo esa. Si el pedido tenia un cambio de comprobante pendiente, se aplica antes.
   Caso «pidio boleta y luego factura»: en el detalle del pedido pulsa Cambiar comprobante, elige Factura, escribe el RUC y el motivo (Si). Luego pulsa «Aplicar ahora» (Si/No): si la boleta aun no habia salido a SUNAT se reemplaza sin anular nada; si ya habia salido se da de baja (SUNAT la recibe en el resumen de esta noche) y la factura se emite en ese momento. El mensaje al terminar dice que se hizo.
6. Un pedido anulado antes de la noche no se emite. Si algo falla al enviar, queda en Electronicos SUNAT con su estado y el boton Reintentar, como siempre.
7. En Electronicos SUNAT los pendientes de la noche aparecen con la insignia Se emite esta noche.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Como se hace: Corregir la boleta o factura despues del cobro
1. Abre el detalle del pedido, seccion Comprobantes, y pulsa Cambiar comprobante. Lo pueden hacer el Administrador y el Cajero.
2. Elige simple, boleta o factura, escribe el DNI o el RUC (el sistema busca el nombre o la razon social) y el motivo, de al menos 5 letras. Confirma con Si.
3. No se emite en ese momento: el pedido muestra Cambiara a Factura RUC (o a lo que elegiste) esta noche. Hasta entonces puedes pulsar Deshacer, o volver a cambiar: el ultimo cambio del dia reemplaza al anterior.
4. En el envio de la noche se aplica el cambio antes de enviar. Si el comprobante original todavia no habia salido a SUNAT, se reemplaza sin enviar nada. Si ya habia salido (comprobantes de antes del envio nocturno), se da de baja una sola vez y se emite el nuevo.
5. Cada cambio queda en la auditoria con quien lo pidio y el motivo. Un pedido anulado no se cambia ni se emite.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Como se hace: Factura enviada por WhatsApp al cliente
1. Cuando SUNAT acepta una FACTURA real (no una boleta, no una nota de venta, no una de prueba), el bot manda el PDF al celular del pedido, que es su WhatsApp. Sale una sola vez por factura, sin que nadie haga nada.
2. Si el pedido no tiene celular valido (9 digitos que empiezan con 9), no se envia nada y la etiqueta dice Sin celular. Los pedidos del personal tampoco reciben nada.
3. En Electronicos SUNAT y en el detalle del pedido, cada factura muestra una etiqueta: Enviada por WhatsApp (con la hora), Sin celular, Sin ventana de WhatsApp, Error al enviar, Apagado o No enviada.
4. WhatsApp solo deja mandar un documento libre si el cliente escribio al bot en las ultimas 24 horas. Si no, y hay una plantilla de factura configurada y aprobada en Meta, sale por la plantilla; si no hay plantilla queda Sin ventana de WhatsApp y el sistema reintenta unas pocas veces (a los 15 minutos, 1 hora, 4 horas y 12 horas) por si el cliente escribe, y luego se cierra.
5. Para volver a mandarla (fallo, o el cliente la pide de nuevo), pulsar Reenviar por WhatsApp en la factura y confirmar con Si. Respeta la ventana de 24 horas y cuenta como un mensaje mas en Meta. Requiere el permiso de emitir comprobantes.
6. El Administrador enciende o apaga el envio automatico (y escribe el nombre de la plantilla de Meta) en Electronicos SUNAT, seccion Factura por WhatsApp. Viene encendido. Apagado, no se envia nada, ni siquiera con Reenviar.
7. Las facturas aceptadas antes de activar esta funcion no se envian solas: usa Reenviar por WhatsApp si hace falta.
Antes: [[caja]]
Ver tambien: [[mensajes]]

## Errores y dudas comunes
- Un pedido con Comprobante simple no tiene boleta ni factura: no sale en Por emitir ni en Electronicos SUNAT. Si el cliente la pide despues, usa Cambiar comprobante (aunque ya este cobrado: se emite esa noche).
- Una boleta o factura sin numero que dice Se emite esta noche es normal: el numero se asigna al enviarla. Si pasada la hora sigue asi, avisa al Administrador.
- Para emitir una factura, es requisito obligatorio contar con un RUC valido de 11 digitos que inicie con 10, 15, 17 o 20 y su correspondiente razon social.
- En la carta, el cliente que pide factura solo escribe el RUC: la razon social y la direccion fiscal salen de SUNAT (se guardan en el sistema 30 dias) y no se pueden editar. Si SUNAT no responde, el cliente escribe la razon social a mano y queda sin verificar: revisala antes de emitir. Al crear o cambiar un comprobante en Caja, al completar el RUC la razon social se rellena sola y la puedes corregir.
- La factura por WhatsApp no se manda con la ventana de 24 horas cerrada si no hay plantilla aprobada en Meta: la etiqueta dice Sin ventana de WhatsApp. Pide al cliente que escriba al bot y vuelve a pulsar Reenviar por WhatsApp.
- La reimpresion de notas de venta deja huella en el sistema indicando cuantas veces se ha reimpreso el ticket para prevenir duplicidades en cobranza.
- Si la ticketera no imprime, revisar que tenga papel y este encendida antes de reintentar la reimpresion.

## Quien puede hacerlo
- Administrador y Cajero son los unicos autorizados para acceder a Comprobantes y realizar reimpresiones.
- Ningun otro rol tiene acceso a este modulo.
