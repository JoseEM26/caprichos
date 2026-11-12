---
modulo: recetas
titulo: Recetas
ruta: /admin/recetas
permiso: stock/ver
roles: [ADMIN]
relacionados: [productos, stock, almacen, cocina]
sugerencias:
  - ¿Cómo configuro los ingredientes que lleva un plato de la carta?
  - ¿Cómo pongo cantidades distintas para cada tamaño de bebida?
  - ¿Dónde veo el costo de insumos y el margen de ganancia de un producto?
  - ¿Cómo quito un ingrediente de una receta que cambió?
---
# Recetas

## Para que sirve
Permite definir la ficha tecnica y la formulacion estandar de cada plato, bebida o postre en [[productos]]. Especifica que insumos de [[stock]] y que cantidad en gramos, mililitros o unidades se descuentan del inventario de forma automatica cada vez que se vende una porcion, calculando el costo total de materia prima y el margen de rentabilidad obtenido.

## Como se hace: Configurar o editar la receta de un producto
1. En la lista de productos de la carta, pulsa sobre el plato o bebida que deseas configurar.
2. La pantalla abrira la ficha tecnica mostrando la lista de insumos asignados a su preparacion.
3. Para anadir un ingrediente nuevo, pulsa el boton "+ Agregar insumo".
4. Selecciona el insumo de la lista desplegable y escribe la cantidad requerida por porcion respetando la unidad de medida del insumo (por ejemplo gramos para cafe o mililitros para jarabe).
5. Pulsa el boton "Guardar receta". En el cuadro de dialogo de confirmacion, pulsa "Si, continuar".
Antes: [[productos]]
Antes: [[stock]]
Despues: [[caja]]
Ver tambien: [[cocina]]

## Como se hace: Configurar recetas independientes por tamano
1. Si el producto ofrece diferentes presentaciones (como Personal, Mediano o Familiar) definidas en [[listas]], activa la opcion de desglose por tamano en la parte superior de la receta.
2. Pulsa sobre la pestana del tamano que deseas configurar.
3. Define las cantidades e insumos correspondientes a esa presentacion especifica.
4. Repite el procedimiento para los demas tamanos que ofrezca el producto.
5. Pulsa "Guardar receta" y confirma con "Si, continuar".
Antes: [[listas]]
Ver tambien: [[productos]]

## Como se hace: Eliminar o corregir un ingrediente en la receta
1. En la tabla de ingredientes de la receta activa, modifica la cantidad directamente en la casilla numerica correspondiente si hubo un cambio de proporcion.
2. Si un insumo ya no forma parte de la elaboracion del plato, pulsa el boton con el icono de tacho o "Quitar" en la fila del insumo.
3. Pulsa "Guardar receta" y confirma los cambios seleccionando "Si, continuar".
Ver tambien: [[stock]]

## Como se hace: Receta propia de un sabor
1. En la tarjeta de la receta, busca la fila "Receta para:". Si el producto tiene sabores (donas, galletas), veras "General" y un boton por sabor. Cada sabor dice si tiene receta "propia" o usa la "general", con su costo.
2. Pulsa el sabor. Si usa la general, te lo avisa: lo que ves es la receta general.
3. Pulsa "Crear receta propia para este sabor". El editor se abre con la receta general como punto de partida: cambia los insumos o cantidades y pulsa "Guardar", luego "Si, guardar receta".
4. Para editarla despues, entra al sabor y pulsa "Editar receta del sabor".
5. Para que el sabor vuelva a la receta general, pulsa "Quitar receta del sabor (volver a la general)" y confirma con "Si, quitar". Lo ya consumido no cambia.
Al marcar "Listo" en [[cocina]], cada sabor descuenta su receta propia; si no tiene, descuenta la general. Si el control de almacen esta apagado, puedes preparar las recetas igual, pero aun no se descuenta stock.
Ver tambien: [[almacen]]

## Como se hace: Evaluar el costo de materia prima y margen
1. Dentro de la ficha tecnica del producto, observa el bloque de calculo de costos en la parte inferior o lateral.
2. El sistema multiplica la porcion de cada ingrediente por su costo de compra promedio para calcular el "Costo total de insumos".
3. Compara el costo resultante contra el "Precio de venta" al publico para comprobar el margen bruto y asegurar la rentabilidad del articulo.
Ver tambien: [[indicadores]]

## Errores y dudas comunes
- Que pasa si se vende un producto que no tiene receta: el pedido se cobra y se procesa normalmente en caja, pero el sistema no descontara ningun insumo del inventario al no existir una formula registrada.
- Cambiar una receta afecta las ventas pasadas: no, las correcciones y modificaciones en las recetas tienen efecto exclusivamente sobre las ventas y preparaciones que se registren a partir del momento en que se guardan los cambios.

## Quien puede hacerlo
- Administrador: es el unico rol que cuenta con autorizacion para consultar, disenar y modificar las formulas, fichas tecnicas, costos y margenes de recetas en el sistema (permisos recetas/ver y recetas/editar).
- Otros roles (Cocina, Almacen, Cajero, Mozo): no tienen acceso a la edicion de recetas ni a la visualizacion de formulas de costo en este modulo.
