---
modulo: apertura
titulo: Apertura del dia (conteo de productos terminados)
ruta: /admin/apertura
permiso: almacen/apertura
roles: [ADMIN, CAJERO, COCINA, ALMACEN]
relacionados: [productos, almacen, stock, cocina, caja, escritorio]
sugerencias:
  - Como hago el conteo de apertura de las donas y galletas
  - Que es Quedaron de ayer y Produje hoy
  - Como boto a merma una dona vencida
  - Por que la carta dice Quedan 4 o Ultimos 2
  - Que hago si el sistema dice Solo quedan N
  - Por que me pide confirmar una diferencia grande
  - Como activo el control de stock de un producto
---
# Apertura del dia (conteo de productos terminados)

## Para que sirve
Es el conteo diario de los productos que se acaban en el dia, como donas y galletas (productos terminados, distintos de los insumos de [[almacen]]). Cada manana se cuenta lo que quedo de ayer, se suma lo que se produjo hoy y se guarda. Con eso la carta, el bot de WhatsApp, el mozo y caja saben cuantos quedan: al vender se descuenta solo, al llegar a 0 el producto (o el sabor) se marca Agotado y, al final, la carta muestra "Quedan N" y "!Ultimos N!".

Solo aparecen los productos que tienen marcada la casilla "Controlar stock de este producto" en [[productos]]. Si no hay ninguno, la pantalla dice "No hay productos con control de stock". El saldo nunca se reinicia a cero por si solo: es el tope de lo vendible, haya o no apertura de hoy.

## Como se hace: Hacer el conteo de apertura
1. Abre Compras y stock, Apertura del dia (o pulsa Contar ahora en la franja "Falta el conteo de apertura de hoy (N productos)" que sale arriba en Cocina).
2. Arriba lees "Dia dd/mm/aaaa", cuantos productos hay y "faltan N por contar" (o "todos contados hoy"). Puedes buscar con "Buscar producto o sabor", activar "Solo los que faltan contar" y usar Desplegar todos / Plegar todos para los sabores.
3. La tabla esta agrupada por area. Por cada producto (o por cada sabor, si lleva sabores) completa: "Quedaron de ayer" (lo que cuentas fisicamente; corrige el saldo si no coincide), "Produje hoy (+)" (lo que produjiste esta manana, que se suma) y mira el Total.
4. El Estado dice Falta contar, Contado hoy o Agotado (total 0). Los campos aceptan solo numeros enteros de 0 o mas; si no, "Escribe un numero entero de 0 o mas.".
5. Pulsa Guardar apertura (N). Veras "Apertura guardada: N productos.". Se guardan los que cambiaste y los que aun no tenian apertura hoy; si no hay nada nuevo dice "No hay cambios que guardar. Todos los productos ya tienen su apertura de hoy.".
6. Si alguna cantidad difiere en mas de la mitad del saldo, aparece "!Guardar una diferencia grande?" con el detalle (saldo y ahora). Pulsa "Si, guardar" si es correcto o "No, revisar".
Antes: [[productos]]
Despues: [[cocina]]

## Como se hace: Botar un producto a merma
1. En la fila del producto o sabor, pulsa el icono Botar a merma (se desactiva si el saldo es 0).
2. En el dialogo escribe cuantas botas (entero de 1 hasta el saldo), elige el motivo (Vencido, Danado, Se cayo u Otro) y una nota (obligatoria si el motivo es Otro).
3. Pulsa Confirmar merma. Veras "Botado a merma: N. Quedan M.". No pide codigo del supervisor: Cocina lo registra y queda auditado con quien y cuando.
4. La merma de productos terminados es distinta de la merma de insumos: ver [[cocina]].

## Como se hace: Activar el control de stock de un producto
1. En Catalogo, Productos, abre el producto y marca "Controlar stock de este producto". Ver [[productos]].
2. Al dia siguiente aparecera en Apertura del dia para contarlo. Si el producto tiene sabores, el stock se lleva por sabor; las galletas sin sabores llevan un stock unico en unidades.

## Que ve el cliente en la carta
- Con 4 o 5 unidades: "Quedan N" (discreto).
- Con 1 a 3 unidades: franja "!Ultimos N!".
- Con 0: el boton dice Agotado y no se puede agregar. Si un sabor se agota solo ese sabor queda bloqueado.
- La carta se refresca sola cada 20 segundos y al abrir el carrito o el pago.

## Errores y dudas
- 409 STOCK_INSUFICIENTE "Solo quedan N de [producto o sabor]": alguien pidio mas de lo que hay. En la carta el cliente ve el aviso y ajusta la cantidad; en caja o mozo, quita unidades o cuenta de nuevo si el saldo esta mal.
- 409 SABOR_AGOTADO "El sabor X esta agotado": ese sabor no se puede elegir hoy. Cambia de sabor, o cuenta la apertura si en realidad si hay.
- "Falta contar" en un producto: aun no se guardo la apertura de hoy; la carta usa el saldo anterior como tope.
- "Ese producto no controla stock: no lleva conteo de apertura": marca primero la casilla en Productos.
- "X lleva conteo por sabor: indica el sabor de cada cantidad": en productos con sabores se cuenta cada sabor por separado.
- "Solo hay N. No puedes botar mas de lo que hay." / "Si el motivo es Otro, escribe una nota.": corrige el dialogo de merma.
- "No se pudo cargar la apertura del dia." / "No se pudo guardar la apertura. Revisa la conexion...": reintenta.
- Un producto oculto en la carta no aparece en la apertura.

## Quien puede hacerlo
Administrador, Cajero, Cocina y Almacen (permiso almacen/apertura). El Supervisor y el Mozo no hacen la apertura. Botar a merma (producto terminado) solo lo registran Cocina y el Administrador (permiso almacen/merma_producto); Cajero y Almacen cuentan pero no botan.
