---
modulo: stock
titulo: Stock y recetas
ruta: /admin/stock
permiso: stock/ver
roles: [ADMIN, ALMACEN, COCINA]
relacionados: [almacen, compras, recetas, cocina, productos, apertura]
sugerencias:
  - ¿Qué significan los colores del semáforo en los insumos?
  - ¿Cómo doy de alta un nuevo insumo con su stock mínimo?
  - ¿Cómo corrijo el stock de un insumo si no coincide con lo físico?
  - ¿Dónde veo la cantidad total de insumos que tengo en el local?
---
# Stock y recetas

## Para que sirve
Permite supervisar el estado integral de existencias de todos los insumos, materias primas y productos de Caprichos. Muestra de forma inmediata que articulos se encuentran por debajo del nivel minimo mediante un semaforo visual (rojo, amarillo y verde), permite dar de alta insumos nuevos, actualizar umbrales de alerta y revisar las formulas configuradas en [[recetas]].

## Como se hace: Supervisar insumos con stock bajo o critico
1. Haz clic en la pestana "Insumos".
2. En la parte superior de la pantalla veras una insignia naranja con el numero total de insumos que requieren atencion inmediata.
3. Utiliza los filtros rapidos por color de semaforo para listar insumos en "Rojo" (por debajo del minimo permitido) o "Amarillo" (en zona de advertencia intermedia).
4. Revisa la columna "Stock total" para verificar la suma de existencias disponibles entre el [[almacen]] principal y la [[cocina]].
Despues: [[compras]]
Ver tambien: [[productos]]

## Como se hace: Dar de alta un insumo nuevo
1. En la pestana "Insumos", pulsa el boton "+ Insumo".
2. Escribe el nombre del insumo, selecciona la categoria correspondiente y define la unidad de medida con la que se controlara (por ejemplo kilogramos, litros, unidades o gramos).
3. Configura el valor de "Stock minimo" y el valor de "Stock intermedio" para que el semaforo avise oportunamente antes de que se agote.
4. Ingresa el costo de referencia por unidad y pulsa "Guardar insumo". Confirma la creacion pulsando "Si, continuar".
Despues: [[recetas]]
Ver tambien: [[compras]]

## Como se hace: Editar umbrales o datos de un insumo existente
1. Localiza el insumo en la tabla y pulsa el boton "Editar".
2. Modifica el nombre, la unidad de medida, la categoria o ajusta los valores de stock minimo e intermedio segun el consumo promedio del negocio.
3. Pulsa "Guardar cambios" y en la ventana emergente confirma con "Si, continuar".
Ver tambien: [[almacen]]

## Como se hace: Registrar un ajuste de inventario por conteo
1. En la fila del insumo que presenta diferencias, pulsa el boton "Ajustar".
2. Escribe la cantidad real contabilizada durante el conteo fisico en el local.
3. Especifica el motivo de la regularizacion (como ajuste por inventario general, error en compras o merma no asentada).
4. Pulsa "Confirmar ajuste" para actualizar el saldo total del insumo.
Despues: [[almacen]]

## Errores y dudas comunes
- Que indica cada color del semaforo: el verde senala existencias suficientes por encima del umbral de seguridad; el amarillo alerta que el producto esta cerca de agotarse; el rojo indica que las existencias cayeron por debajo del minimo requerido o llegaron a cero.
- Por que aparece un insumo con saldo negativo: ocurre si se confirmaron ventas de platos en caja antes de ingresar la compra o traslado de los insumos que componen la receta. Se soluciona registrando la compra o haciendo un ajuste de saldo.
- Para que sirve la pestana Produccion y almacen: permite enlazar directamente con las ordenes de preparacion de productos por tanda y registrar consumos vinculados.

- Y las donas y galletas: no estan aqui. El stock de productos terminados (donas, galletas, postres con la casilla "Controlar stock de este producto") se cuenta cada dia en [[apertura]] y se configura en [[productos]]; el control de almacen no los gobierna.

## Quien puede hacerlo
- Administrador: tiene acceso completo para crear insumos, modificar umbrales, realizar ajustes de inventario y editar recetas asociadas.
- Almacen: puede consultar existencias, dar de alta insumos, actualizar datos tecnicos y efectuar ajustes de conteo.
- Cocina: puede revisar el listado y el semaforo de existencias de insumos para monitorear la disponibilidad de ingredientes en su turno.
- Cajero, Mozo y Repartidor: no tienen acceso al modulo de stock.
