---
modulo: caja
titulo: Pedidos y caja
ruta: /admin/caja
permiso: caja/ver
roles: [ADMIN, CAJERO]
relacionados: [cierre, cocina, comprobantes, repartos, plano, supervisor-codigo]
sugerencias:
  - Como abro la caja al iniciar mi turno
  - Como cobro un pedido y registro el vuelto
  - Como anulo un pedido que el cliente cancelo
  - Como paso un pedido a cocina cuando no esta pagado
---
# Pedidos y caja

## Para que sirve
Modulo central para la recepcion, seguimiento y cobro de pedidos en salon, para llevar y a domicilio. Conecta la preparacion en [[cocina]], la entrega por [[repartos]], la emision de [[comprobantes]] y el balance final en [[cierre]].

## Como se hace: Abrir la caja del turno
1. En la barra superior, pulsar el boton Abrir caja.
2. En el campo Monto inicial en efectivo, ingresar el fondo fijo de apertura en soles.
3. Pulsar el boton Abrir caja ahora. El estado de la barra superior cambiara a Caja abierta.
Antes: [[supervisor-codigo]]
Despues: [[caja]]

## Como se hace: Cobrar un pedido
1. En la lista de pedidos o desde la pestana Por confirmar o Pago por coordinar, ubicar el pedido y pulsar el boton Cobrar.
2. Seleccionar el medio de pago: Efectivo, Yape, Plin, Tarjeta o Transferencia.
3. Si el medio es efectivo, ingresar el monto recibido en el campo Recibido para que la pantalla calcule el vuelto exacto. Tambien se pueden combinar multiples medios de pago si el cliente divide la cuenta.
4. Pulsar el boton Confirmar cobro para finalizar.
Antes: [[cocina]]
Despues: [[comprobantes]]
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

## Errores y dudas comunes
- Si al anular se ingresa un codigo de supervisor incorrecto o vencido, aparece el mensaje: Codigo del supervisor invalido. Pídelo nuevamente a la supervisora.
- No se puede cerrar la caja al finalizar el dia si existen pedidos pendientes de cobro; deben cobrarse o anularse primero.
- Si un pedido por delivery no tiene ubicacion GPS o referencia clara, debe ubicarse en el mapa antes de enviarse a despacho.

## Quien puede hacerlo
- Pueden ingresar y operar en Pedidos y caja: Administrador y Cajero.
- Los demas roles (Cocina, Mozo, Repartidor, Almacen) no tienen acceso a esta pantalla.
- La anulacion de pedidos y cobros requiere siempre la autorizacion con el codigo de supervisor de 6 digitos.
