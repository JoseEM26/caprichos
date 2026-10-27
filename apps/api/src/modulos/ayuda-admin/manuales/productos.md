---
modulo: productos
titulo: Productos
ruta: /admin/productos
permiso: catalogo/ver
roles: [ADMIN, CAJERO]
relacionados: [listas, stock, recetas, ofertas, destacadas]
sugerencias:
  - ¿Cómo creo un producto nuevo en la carta?
  - ¿Cómo marco un producto como agotado para que no se venda?
  - ¿Dónde le cambio el precio o la foto a un producto?
  - ¿Cómo agrego tamaños o grupos de opciones a un plato?
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

## Errores y dudas comunes
- No encuentro el boton para eliminar un producto: los productos no se borran del sistema para proteger el historial de ventas y reportes anteriores. Si ya no se va a vender, marcalo como agotado o utiliza la opcion de ocultar.
- Que significa la opcion "No suma puntos ni aplica cupones": sirve para promociones con margen ajustado. Cuando esta activada, el producto no genera puntos de recompensa, no se puede canjear con puntos y no admite cupones de descuento.
- La foto subida no aparece: confirma que la imagen este en formato JPG o PNG y espera a que termine de cargar antes de pulsar guardar cambios.

## Quien puede hacerlo
- Administrador: tiene acceso completo para crear productos, modificar precios, actualizar fotografias, cambiar opciones, editar sabores y alternar el estado de agotado o disponible.
- Cajero: puede entrar al modulo para consultar los precios, descripciones y disponibilidad de los productos, pero no tiene permisos para crear productos nuevos ni modificar los existentes.
- Otros roles (Cocina, Mozo, Repartidor, Almacen, Call Center): no tienen acceso a este modulo.
