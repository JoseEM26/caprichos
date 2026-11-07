---
modulo: productos
titulo: Productos
ruta: /admin/productos
permiso: catalogo/ver
roles: [ADMIN, CAJERO, SUPERVISOR]
relacionados: [listas, stock, recetas, ofertas, destacadas, apertura, almacen, cocina]
sugerencias:
  - ¿Cómo creo un producto nuevo en la carta?
  - ¿Cómo marco un producto como agotado para que no se venda?
  - ¿Dónde le cambio el precio o la foto a un producto?
  - ¿Cómo agrego tamaños o grupos de opciones a un plato?
  - ¿Cómo hago que las donas o galletas descuenten stock al venderse?
  - ¿Cómo configuro los sabores de las donas y cuántas unidades trae cada tamaño?
  - ¿Cómo enlazo una opción como '2 Donas' con el stock?
  - ¿Por qué la carta dice Quedan 4 o Últimas 2?
---
# Productos

## Para que sirve
Permite administrar la oferta de productos que se muestran en la carta virtual, en el chatbot y en el sistema de toma de pedidos en [[caja]]. Desde aqui se crean productos nuevos, se actualizan precios y fotos, se configuran opciones y tamanos vinculados a [[listas]], y se controla la disponibilidad marcando articulos como disponibles o agotados.

## Como se hace: Crear un producto nuevo
1. En la parte superior de la pantalla, pulsa el boton naranja "+ Nuevo producto".
2. En la ventana que aparece, escribe el nombre del producto, selecciona la categoria en la lista desplegable y escribe el precio base en soles. Si la categoria todavia no existe, escribe su nombre en el campo rapido y pulsa "Crear categoria".
3. De manera opcional, redacta una descripcion breve que informe al cliente sobre los ingredientes o caracteristicas del producto.
4. Pulsa el boton "Guardar producto". Aparecera un cuadro de confirmacion preguntando si deseas agregar el producto a la carta.
5. Pulsa "Si, continuar" para confirmar. El producto quedara registrado y visible en la lista de su categoria.
Antes: [[listas]]
Despues: [[recetas]]
Ver tambien: [[stock]]

## Como se hace: Marcar un producto como agotado o disponible
1. Localiza el producto en la lista utilizando el buscador superior o haciendo clic en la pestana de su categoria.
2. En la tarjeta o fila del producto, pulsa el boton "Marcar agotado" (o "Marcar disponible" si ya se encontraba agotado).
3. Se abrira una ventana de confirmacion explicando que el producto dejara o volvera a ofrecerse en la carta virtual y el chatbot.
4. Pulsa "Si, continuar". El estado cambiara de inmediato sin recargar la pagina.

Hay dos tipos de agotado y la tarjeta (y el editor) dicen cual es. "Agotado a mano (no vuelve solo)": lo marcaste tu o cocina con "Marcar agotado"; se queda asi hasta que alguien pulse "Marcar disponible" aqui o Reactivar en Cocina > Agotados. No lo quita la apertura del dia, ni reponer stock, ni anular un pedido. "Agotado por stock (vuelve al reponer)": el sistema lo marco porque el saldo de un producto con "Controlar stock" llego a 0; vuelve solo al reponer, al hacer la apertura del dia o al anular un pedido que lo habia descontado. Si apagas "Controlar stock" y guardas, se limpia el agotado por stock pero se respeta el agotado a mano. La carta y el bot muestran no disponible en ambos casos.
Antes: [[stock]]
Ver tambien: [[cocina]]

## Como se hace: Editar precio, foto o sabores de un producto
1. Busca el producto en el catalogo y pulsa el boton "Editar".
2. En el panel de edicion, modifica el nombre, la categoria o el precio segun corresponda.
3. Para cambiar la imagen, pulsa "Subir imagen" y elige un archivo desde tu equipo, o pulsa "Quitar foto" si deseas eliminar la imagen actual.
4. Si el producto maneja sabores, anade nuevos sabores en el campo de texto y pulsa "+ Sabor", o activa y desactiva los existentes.
5. Pulsa el boton "Guardar cambios". En el cuadro de dialogo que pregunta si deseas guardar los cambios, pulsa "Si, continuar".
Ver tambien: [[disenador]]

## Como se hace: Configurar tamanos y grupos de opciones
1. En el producto que deseas configurar, pulsa el boton "Opciones y tamanos".
2. En la seccion de tamanos, marca las casillas de los tamanos que ofrece el producto (por ejemplo personal o familiar) y define el precio de cada uno.
3. En la seccion de grupos, selecciona los grupos de opciones aplicables definidos en [[listas]] (como salsas, tipos de leche o adicionales) y ajusta los limites minimos y maximos de seleccion.
4. Pulsa el boton "Guardar cambios". En la confirmacion que aparece, pulsa "Si, continuar".
Antes: [[listas]]
Despues: [[recetas]]

## Como se hace: Controlar el stock de un producto terminado (donas, galletas, postres)
Para productos que se acaban en el dia. Los insumos (leche, harina) se siguen controlando en [[stock]] y [[almacen]]; el interruptor Control de almacen solo gobierna insumos y recetas.
1. Abre el producto (Nuevo producto o Editar) y marca la casilla "Controlar stock de este producto" ("se descuenta al vender, se marca Agotado al llegar a 0 y la carta muestra cuantos quedan. Necesita el conteo de apertura de cada dia"). Guarda. En la tarjeta aparece la insignia Con stock (o Stock por sabor si tiene sabores).
2. Cada dia se cuenta en [[apertura]]. Los productos de la categoria Postres ya vienen con el control activado.
3. Un producto oculto no entra al conteo.
4. El saldo siempre es el tope de venta, haya o no apertura de hoy: no se puede vender mas de lo que hay.
Despues: [[apertura]]

## Como se hace: Configurar sabores y unidades por tamano (donas y galletas)
1. En el editor del producto, en "Sabores o variantes" agrega cada sabor en "Nuevo sabor (ej.: Pistacho, Nutella, Americana)". Cada sabor se marca Disponible o Agotado tocandolo, y muestra "Quedan N" o "Sin apertura hoy". Los sabores son las opciones que el cliente elige (relleno, sabor) y tambien las usa el bot de WhatsApp.
2. El stock de cada sabor no se escribe aqui: se registra en Apertura del dia (Almacen).
3. En Tamanos y precios, en la columna Unidades escribe cuantas unidades incluye cada tamano: Unidad 1, 1/2 docena 6, Docena 12. Asi, vender una media docena descuenta 6 del stock, y el tope en la carta se calcula en unidades.
4. El cliente reparte las unidades de la media docena o docena entre sabores (selector con "Completo" cuando termina de repartir, atajo "Todas del mismo sabor"). En cocina, mis pedidos y etiquetas se ve el reparto, por ejemplo "2 Fresa · 3 Oreo".
5. Los sabores sin stock salen bloqueados ("No hay stock" o "Solo quedan N de X"); al llegar a 0 ese sabor se marca Agotado solo.
6. Galletas sin sabores: la galleta (por ejemplo choco chips) lleva un stock unico por producto, en unidades, sin sabores; la media docena descuenta 6.

## Como se hace: Enlazar una opcion con el stock (Stock de cada opcion / Enlaces de stock)
1. En el editor de opciones y tamanos del producto, baja a la seccion "Stock de cada opcion": "Si una opcion consume stock (p. ej. '2 Donas'), indica que producto y cuantas unidades. Si no hay saldo, la opcion queda agotada en la carta y en WhatsApp."
2. Elige la Opcion, pulsa Agregar stock, escoge el Producto, el Sabor (o "Todo el producto") y la Cantidad (1 a 99). Pulsa Guardar stock de la opcion; veras "Enlace de stock guardado.". Quitar borra una fila.
3. Ejemplo: "2 Donas" consume 2 de DONAS ARTESANALES; "Crema pastelera" consume 1 del sabor Crema pastelera de las donas.
4. Sin filas, la opcion solo depende del boton Agotado, como antes.
5. Si no alcanza el saldo, la carta muestra la opcion agotada y el pedido responde 409 OPCION_AGOTADA ("No hay stock suficiente para elegir X").
Ver tambien: [[ofertas]]

## Que ve el cliente cuando hay poco stock
- 4 o 5 unidades: "Quedan 4" (discreto). 3 unidades: franja "¡Quedan solo 3, ya se acaban!". 2 unidades: "¡Últimas 2!". 1 unidad: "¡Última dona!" (o "¡Última unidad!" si el nombre del producto no es simple). Sin saldo: Agotado.
- Con sabores, cada sabor avisa en la ventana del producto ("Fresa: ¡última!", "Oreo: quedan 2") y la tarjeta avisa por el total.
- El bot de WhatsApp agrega la misma línea (por ejemplo "🍩 ¡Quedan solo 3, ya se acaban!") en el menú, al pedir la cantidad y en el resumen si el pedido se lleva casi todo el saldo. Lo agotado sigue sin mostrarse.
- Desde cuántas unidades avisa se ajusta en Configuración, Parámetros del sistema: "Avisar «Quedan N» desde" (5 por defecto) y "Franja «¡Últimas!» desde" (3 por defecto), de 0 a 20; 0 lo apaga. La franja nunca puede pasar del aviso. El texto del bot se edita en Configuración, Chatbot.
- Si el cliente pide mas de lo que queda: "Solo quedan N de X" y el boton Ajustar mi pedido recorta el pedido sin vaciar el carrito.
- Plan B en las opciones: si algunas opciones estan agotadas por stock y otras no, la carta avisa "Se acabaron: X. Elige entre: Y".

## Errores y dudas comunes
- 409 STOCK_INSUFICIENTE "Solo quedan N de X": no alcanza el saldo; ajusta la cantidad o cuenta la apertura si el saldo esta mal.
- 409 SABOR_AGOTADO "El sabor X esta agotado": elige otro sabor.
- 409 OPCION_AGOTADA "La opcion X esta agotada" / "No hay stock suficiente para elegir X": la opcion no se puede elegir hoy.
- "Falta contar" en Apertura: el producto controla stock pero aun no se conto hoy.
- No encuentro el boton para eliminar un producto: los productos no se borran del sistema para proteger el historial de ventas y reportes anteriores. Si ya no se va a vender, marcalo como agotado o utiliza la opcion de ocultar.
- Que significa la opcion "No suma puntos ni aplica cupones": sirve para promociones con margen ajustado. Cuando esta activada, el producto no genera puntos de recompensa, no se puede canjear con puntos y no admite cupones de descuento.
- La foto subida no aparece: confirma que la imagen este en formato JPG o PNG y espera a que termine de cargar antes de pulsar guardar cambios.

## Quien puede hacerlo
- Administrador: tiene acceso completo para crear productos, modificar precios, actualizar fotografias, cambiar opciones, editar sabores y alternar el estado de agotado o disponible.
- Cajero: puede entrar al modulo para consultar los precios, descripciones y disponibilidad de los productos, pero no tiene permisos para crear productos nuevos ni modificar los existentes.
- Otros roles (Cocina, Mozo, Repartidor, Almacen): no tienen acceso a este modulo.
