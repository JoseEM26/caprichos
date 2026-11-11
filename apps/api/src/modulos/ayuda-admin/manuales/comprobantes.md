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
5. Antes de cobrar, en el detalle del pedido pulsa Cambiar comprobante para pasar de uno a otro. Con un comprobante ya emitido hay que anularlo antes.
6. Solo la boleta y la factura se emiten a SUNAT y aparecen en Electronicos SUNAT; el simple no deja nada pendiente de envio.
Antes: [[caja]]
Ver tambien: [[cierre]]

## Errores y dudas comunes
- Un pedido con Comprobante simple no tiene boleta ni factura: no sale en Por emitir ni en Electronicos SUNAT. Si el cliente la pide despues, usa Cambiar comprobante antes de cobrar.
- Para emitir una factura, es requisito obligatorio contar con un RUC valido de 11 digitos que inicie con 10, 15, 17 o 20 y su correspondiente razon social.
- En la carta, el cliente que pide factura solo escribe el RUC: la razon social y la direccion fiscal salen de SUNAT (se guardan en el sistema 30 dias) y no se pueden editar. Si SUNAT no responde, el cliente escribe la razon social a mano y queda sin verificar: revisala antes de emitir. Al crear o cambiar un comprobante en Caja, al completar el RUC la razon social se rellena sola y la puedes corregir.
- La reimpresion de notas de venta deja huella en el sistema indicando cuantas veces se ha reimpreso el ticket para prevenir duplicidades en cobranza.
- Si la ticketera no imprime, revisar que tenga papel y este encendida antes de reintentar la reimpresion.

## Quien puede hacerlo
- Administrador y Cajero son los unicos autorizados para acceder a Comprobantes y realizar reimpresiones.
- Ningun otro rol tiene acceso a este modulo.
