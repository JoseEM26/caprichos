---
modulo: almacen
titulo: Almacén
ruta: /admin/almacen
permiso: stock/ver
roles: [ADMIN, ALMACEN, COCINA]
relacionados: [stock, compras, cocina, supervisor-codigo]
sugerencias:
  - ¿Cómo traslado insumos del almacén a la cocina o barra?
  - ¿Cómo registro una merma de productos dañados o vencidos?
  - ¿Cómo anoto los productos que preparé hoy en producción?
  - ¿Por qué el sistema me pide el código del supervisor al anular?
---
# Almacén

## Para que sirve
Permite supervisar y registrar el flujo interno de mercaderias e insumos entre las diferentes areas del negocio. Desde aqui se asientan traslados hacia [[cocina]] o barra, mermas por vencimiento o desperdicio, producciones elaboradas por lote segun [[recetas]], solicitudes internas y el pase de sobrantes a merma en el cierre del dia.

## Como se hace: Registrar un traslado a cocina o barra
1. En la parte superior del modulo, pulsa el boton naranja "Registrar movimiento".
2. En el campo "Tipo de movimiento", selecciona "Traslado a cocina" (o el area de destino correspondiente).
3. Selecciona la ubicacion de origen (Almacen) y la ubicacion de destino (Salados o Bebidas).
4. Elige el insumo a trasladar, escribe la cantidad exacta en su unidad de medida y anade una observacion si es necesario.
5. Pulsa "Guardar movimiento". Las existencias se descontaran de la ubicacion de origen y aumentaran en el destino de manera automatica.
Antes: [[stock]]
Despues: [[cocina]]
Ver tambien: [[almacen]]

## Como se hace: Registrar una merma o desperdicio de insumos
1. Pulsa el boton "Registrar movimiento".
2. En tipo de movimiento, elige "Merma / Perdida".
3. Selecciona la ubicacion donde se detecto el problema, el insumo afectado, la cantidad que se da de baja y el motivo detallado de la perdida (como fecha de vencimiento cumplida o rotura accidental).
4. Si la cantidad de la merma es igual o superior a 10 unidades o kilogramos, el sistema solicitara de forma obligatoria el codigo del supervisor de 6 digitos generado en [[supervisor-codigo]].
5. Pulsa "Confirmar merma" para descontar las unidades del inventario.
Requiere: [[supervisor-codigo]]
Ver tambien: [[informes]]

## Como se hace: Registrar produccion elaborada (Hoy preparé)
1. Pulsa el boton "Hoy preparé...".
2. Selecciona el producto elaborado por tanda o porcion (por ejemplo masa para waffles, jarabes preparados o salsas de la casa).
3. Ingresa la cantidad de unidades o porciones obtenidas.
4. Pulsa "Registrar produccion". El sistema aumentara las existencias del producto preparado y descontara automaticamente las cantidades correspondientes de cada insumo segun su formula en [[recetas]].
Antes: [[recetas]]
Despues: [[stock]]
Ver tambien: [[cocina]]

## Como se hace: Anular un movimiento registrado por error
1. En la tabla de movimientos recientes, busca la fila del movimiento que deseas revertir y pulsa el boton "Anular".
2. Escribe una explicacion clara en el campo de motivo de la anulacion.
3. Ingresa el codigo del supervisor de 6 digitos numericos en la casilla de autorizacion proveniente de [[supervisor-codigo]].
4. En el mensaje de confirmacion, pulsa "Confirmar" para que el sistema revierta los saldos de inventario de forma segura.
Requiere: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: Realizar el cierre del dia de almacen
1. Al finalizar las operaciones diarias, pulsa el boton "Cerrar el dia (sobrantes a merma)".
2. Revisa la lista de insumos abiertos o preparados perecibles que deben darse de baja para la siguiente jornada.
3. Pulsa "Confirmar cierre del dia" para asentar las mermas nocturnas y dejar los saldos listos para el dia siguiente.
Despues: [[cierre]]
Ver tambien: [[stock]]

## Como se hace: Encender o apagar el control de almacen
El control de almacen decide si vender toca el stock. Apagado, al cobrar un pedido no se descuenta ningun insumo, no se agotan productos por falta de insumos y no llegan avisos de insumos; las compras, movimientos, mermas y producciones se siguen guardando para ir armando el almacen. Encendido, cada cobro descuenta insumos segun la receta y agota solos los productos que se quedan sin insumos.
1. Entra a Configuracion y abre la pestana "Operacion".
2. En la tarjeta "Control de almacen" pulsa "Encender" (o "Apagar").
3. Si hay insumos de recetas sin stock cargado, el aviso te dice cuantos productos se agotarian al primer cobro. Si todavia falta cargar stock, elige "No, cancelar" y termina de cargar los insumos, compras y proveedores primero.
4. Pulsa "Si, confirmar". El cambio queda registrado en la auditoria.
Nota: solo el administrador puede encender o apagar el control. Mientras este apagado, las pantallas de almacen, stock y compras muestran una franja de aviso.
Antes: [[stock]]
Ver tambien: [[compras]]

## Errores y dudas comunes
- Cuando se requiere el codigo del supervisor: el codigo de 6 digitos se exige siempre para anular cualquier movimiento previo, para anular tandas de produccion y para registrar mermas o ajustes grandes de 10 o mas unidades. El administrador no necesita codigo en ninguno de estos casos.
- Como atender pedidos de insumos enviados por cocina: en la seccion de pedidos internos, localiza el pedido pendiente y pulsa el boton "Marcar entregado" luego de despachar fisicamente los productos.

## Quien puede hacerlo
- Administrador, Almacen y Cocina: tienen permisos para consultar movimientos, registrar traslados, elaborar pedidos internos y registrar producciones del dia.
- Para anular movimientos, producciones o registrar mermas de 10 o mas unidades, se requiere validar adicionalmente el codigo de supervisor rotativo de 6 digitos (salvo para el administrador).
- Cajero, Mozo y Repartidor: no tienen acceso al modulo de almacen.
