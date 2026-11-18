---
modulo: mis-pedidos
titulo: Mis pedidos (mozo)
ruta: /admin/mis-pedidos
permiso: pedidos/crear
roles: [ADMIN, CAJERO, MOZO, SUPERVISOR]
relacionados: [plano, caja, cocina, reservas, notificaciones]
sugerencias:
  - Como veo en que estado esta cada pedido que tome
  - Como subo el voucher de un pedido de mesa
  - Que significa la etiqueta Falta voucher
  - Como busco un pedido por mesa o por nombre del cliente
  - Por que no puedo cambiar un voucher
  - Donde veo la propina de mi pedido
---
# Mis pedidos (mozo)

## Para que sirve
Lista de los pedidos que tomaste tu (mesa, para llevar o delivery), con el estado que les da [[cocina]], el estado del pago y los vouchers de pagos digitales. Sirve para seguir cada pedido sin ir a Caja. El mozo no cierra el cobro: lo deja Pagado por mozo, por verificar, sube el voucher y Caja revisa y confirma el cobro en [[caja]].

Arriba hay un resumen del rango elegido con Pedidos, Total vendido, En curso y Entregados, y filtros En curso, Entregados y Falta voucher. Cada tarjeta muestra el codigo, el nombre del cliente, la mesa o modalidad (Para llevar o Delivery), los productos (Ver N mas / Ver menos) y el estado del pago: Pagado, Pago pendiente o Pago coordinado.

## Como se hace: Buscar y seguir un pedido
1. En el campo "Buscar por nombre, codigo o mesa" escribe el nombre del cliente, el codigo (cp-w021 o CP W021 es lo mismo) o la mesa. Si no hay resultados dice "Ningun pedido coincide con tu busqueda".
2. Usa el filtro En curso para ver los pedidos en cola, preparando, listos o en camino, y Entregados para los terminados.
3. Pulsa Ver detalle (y Ocultar detalle) para ver el Estado y el pago. Si el pedido tiene propina se ve la linea "Propina (aparte)": va aparte de la venta y no la cobra el mozo (ver [[propinas]]).
4. La tarjeta muestra el avance por cocina y las insignias "#N del dia" y "Direccion editada" cuando corresponden.
Ver tambien: [[cocina]]

## Como se hace: Subir, cambiar o quitar el voucher de un pedido
1. Si el pedido se paga con Yape, Plin o Transferencia (total o en parte, con pago dividido), la tarjeta muestra el boton Subir voucher por cada medio. Hasta que se suba aparece la etiqueta Falta voucher; el filtro Falta voucher los junta.
2. Pulsa Subir voucher, toma la foto o sube el archivo. Tambien puedes elegir Subir despues si aun no lo tienes.
3. Para corregir pulsa Cambiar voucher (mira el actual antes de reemplazarlo) o Quitar voucher: el voucher retirado no se borra, queda en el historial como retirado.
4. Solo se puede cambiar antes de que Caja apruebe el pago. Despues sale "Voucher bloqueado: Caja ya aprobo el pago de este pedido. Pide a Caja cualquier cambio.".
5. Si no se puede quitar: "No se pudo quitar el voucher. Intenta de nuevo.".
Antes: [[plano]]
Despues: [[caja]]

## Como se hace: Pedir que anulen un pedido tuyo
1. El mozo no anula pedidos: solo Caja o el Administrador pueden hacerlo (decision del dueno).
2. Avisa a Caja; ella anula el pedido con motivo y se devuelven el stock y los puntos y se libera la mesa.

## Como se hace: Agregar un servicio o producto libre
1. Para algo que no esta en la carta (topping, bola de helado extra, texto en el brownie): al armar el pedido pulsa + Servicio o producto, escribe la Descripcion y el Monto (hasta S/ 500) y, si quieres, para que producto es.
2. En un pedido que ya tomaste y aun no se cobra: Ver detalle, paso 3 Estado y acciones, + Servicio o producto. El total y el plan de pago se actualizan.
3. Si el pedido ya se cobro, el mismo boton abre un pedido extra con ese cargo (con su propio pago).
4. El texto sale en la comanda y en el sticker del producto elegido. En el detalle la linea dice "Servicio/producto libre · agregado por [nombre] a las HH:MM".
Ver tambien: [[caja]]

## Errores y dudas
- El pedido digital no aparece en cocina hasta que Caja apruebe el voucher; ver [[caja]].
- "Voucher bloqueado": Caja ya aprobo; todo cambio lo hace Caja.
- Un pedido no aparece: revisa el rango de fechas, que sea tuyo y la busqueda.
- Para armar un pedido nuevo en una mesa usa el [[plano]]; para varias mesas ver ese manual.

## Quien puede hacerlo
Mozo, Cajero, Supervisor y Administrador (permiso pedidos/crear). Ve los pedidos que el usuario tomo; Caja y Administrador ven todos en [[caja]]. El mozo no cierra el cobro (Caja lo verifica). Puede dar cortesias dentro de su pedido y registrar cortesias por separado (solo Caja, Mozo y Administrador).
