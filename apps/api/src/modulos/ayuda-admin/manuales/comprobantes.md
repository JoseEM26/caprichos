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

## Errores y dudas comunes
- Para emitir una factura, es requisito obligatorio contar con un RUC valido de 11 digitos que inicie con 10 o 20 y su correspondiente razon social.
- La reimpresion de notas de venta deja huella en el sistema indicando cuantas veces se ha reimpreso el ticket para prevenir duplicidades en cobranza.
- Si la ticketera no imprime, revisar que tenga papel y este encendida antes de reintentar la reimpresion.

## Quien puede hacerlo
- Administrador y Cajero son los unicos autorizados para acceder a Comprobantes y realizar reimpresiones.
- Ningun otro rol tiene acceso a este modulo.
