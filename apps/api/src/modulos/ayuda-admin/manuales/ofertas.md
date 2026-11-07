---
modulo: ofertas
titulo: Ofertas y descuentos
ruta: /admin/ofertas
permiso: ofertas/ver
roles: [ADMIN]
relacionados: [productos, caja, comprobantes, novedades, cocina]
sugerencias:
  - ¿Cómo armo una promoción 2x1 o un combo?
  - ¿Cómo creo un descuento en porcentaje para una categoría?
  - ¿Cómo genero un cupón de descuento con código?
  - ¿Dónde reviso si un cliente ya usó un cupón?
  - ¿Cómo armo un combo con alternativas si se acaba un producto?
  - ¿Qué pasa con el stock cuando se vende un combo?
  - ¿Por qué un combo sale No disponible en la carta?
  - ¿Cómo funciona la Cajita Caprikids?
---
# Ofertas y descuentos

## Para que sirve
Permite gestionar la estrategia de promociones y descuentos comerciales del negocio. Desde este modulo se configuran combos especiales sobre [[productos]], promociones de tipo lleva y paga (como 2x1 o 3x2), rebajas porcentuales o fijas sobre articulos o categorias completas, y cupones de descuento canjeables por codigo al cobrar en [[caja]].

## Como se hace: Armar un combo (constructor por pasos)
Un combo es un paquete con precio propio que el cliente arma eligiendo por partes; aparece en la carta como un producto mas (categoria COMBOS por defecto) y se descuenta producto por producto del stock al vender. Un combo no recibe descuentos ni 2x1.
1. Abre la pestana Promociones y pulsa + Armar oferta. En "Que oferta quieres armar?" elige Combo ("Varios productos por un precio. El cliente elige dentro de cada parte.") o "Llevas mas, pagas menos" (precio especial por llevar varias unidades del mismo producto, como 2x1 o 3x2).
2. Paso 1 de 4, Nombre y categoria de la carta: escribe el nombre, elige la categoria de la carta y, si quieres, sube la Foto de la oferta (si no, la carta muestra la letra inicial sobre fondo dorado).
3. Paso 2 de 4, Que lleva el combo: agrega las partes. Hay tres tipos: "2 bebidas a eleccion" (el cliente escoge entre las categorias que marques, por ejemplo Frappes, Iced o Calientes; se indica la cantidad), "1 complemento fijo" (un producto especifico e invariable, con su Tamano si lo necesita, por ejemplo "Regular 12 oz") y "Una de estas opciones" (el cliente escoge una alternativa armada, por ejemplo una porcion de torta o una dona artesanal). Puedes reordenar y quitar partes. Hace falta al menos una ("Agrega al menos una parte al combo.").
4. En una parte fija puedes definir Alternativas: "Si no hay stock, el cliente podra elegir:". Buscas un producto en "Buscar un producto para agregar como opcion...", le pones Cantidad (cuantas unidades consume) y las ordenas con Subir y Bajar o las quitas con Quitar. Se ofrecen solo cuando el complemento no alcanza, al mismo precio del combo; las agotadas salen bloqueadas.
5. Paso 3 de 4, Cuanto vale el combo y cuando aplica: pon los Precios del combo por tamano (cada tamano con nombre y precio mayor a 0; "+ Agregar otro tamano"), mira la comparacion con la "Suma estimada de productos por separado" y el aviso "Combo mas caro que compras sueltas" si el precio supera la suma. Define los Dias de la semana y el horario (las dos horas o ninguna), y la vigencia por fechas.
6. Paso 4 de 4: revisa la Previsualizacion en la carta virtual y guarda con confirmacion "Guardar nuevo combo?" / "Guardar cambios del combo?".
7. Al editar un combo puedes elegir como se ve cuando esta desactivado ("Mostrar como No disponible" u ocultarlo).
Antes: [[productos]]
Despues: [[caja]]
Ver tambien: [[novedades]]

## Como se hace: Entender el stock, el plan B y los avisos de un combo
1. El stock se hereda: cada eleccion del cliente descuenta el stock de su propio producto (y sabor) al vender, y las lineas se mandan a [[cocina]] por area.
2. Si un producto del combo se acaba, la carta ofrece las Alternativas de esa parte (plan B). Si ninguna tiene stock, o si el unico paso obligatorio sin opciones se acabo, el combo se muestra "No disponible" (en vez de Agotado). Si es una opcion enlazada a stock y esta agotada, la carta avisa "Se acabaron: X. Elige entre: Y" (ver [[productos]], Enlazar una opcion con el stock).
3. En el bot de WhatsApp: un combo agotado avisa que se acabo y sugiere otra cosa; el bot arma el pedido por botones con las reglas de la carta. Una oferta solo vale por WhatsApp si tiene marcada la casilla "WhatsApp (bot)" en "¿Dónde aplica?" del editor (ver "Elegir donde aplica una oferta").
4. Errores: 409 STOCK_INSUFICIENTE "Solo quedan N de X" y 409 SABOR_AGOTADO "El sabor X esta agotado": la eleccion no se puede vender; el cliente cambia de eleccion.

## Como se hace: El combo Cajita Caprikids (partes que salen a cocina como lineas hijas)
1. La Cajita Caprikids es un combo con producto propio (no se repite en Promociones): lleva nuggets, papas mini, un frappe en tamano fijo (Regular 12 oz) y dos juguetes a eleccion.
2. En la carta, en mozo y en Caja el cliente elige dos juguetes (cantidad exacta; los agotados no se pueden elegir). Se muestra "Incluye: producto · tamano".
3. En cocina el combo sale desglosado: la linea madre es solo el contenedor (lleva el precio del combo y no tiene comanda) y cada parte va en su linea hija a su area, con su cantidad y tamano, sin cobro. Comprobantes, ticket y cuenta muestran solo la linea madre. Al anular el pedido el stock de cada hija se devuelve.
4. El tamano de una parte fija se elige en el constructor (Paso 2) para que la etiqueta de la bebida y la comanda salgan con ese tamano y se descuente cantidad × unidades del tamano.
Ver tambien: [[cocina]]

## Como se hace: Armar una promocion "Llevas mas, pagas menos" (2x1, 3x2)
1. En Promociones pulsa + Armar oferta y elige Llevas mas, pagas menos.
2. Elige los productos, la cantidad que lleva y paga, donde aplica (Carta web, En el local y WhatsApp (bot)), los dias y la vigencia.
3. Pulsa guardar y confirma con "Si, continuar".
Antes: [[productos]]

## Como se hace: Elegir donde aplica una oferta (carta web, local y WhatsApp)
1. En el editor de cada oferta (combo, 2x1, descuento, envio gratis) busca "¿Dónde aplica?" y marca las casillas: "Carta web", "En el local (caja y mozo)" y "WhatsApp (bot)". Hay que dejar al menos una marcada.
2. El texto de ayuda debajo cambia segun lo marcado: dice en que canales aplica y, si WhatsApp esta apagado, que el bot no la aplica ni la ofrece.
3. Con WhatsApp marcado: el descuento y el 2x1 se aplican al total del pedido del bot y salen en su resumen; el envio gratis deja el delivery en S/ 0 dentro del horario, dias, fechas, compra minima y limite de pedidos, y el resumen dice "Envio gratis por «nombre»" (si aun no hay ubicacion tambien queda gratis al ubicar el pedido; si falta compra minima el bot avisa cuanto falta); el combo se ofrece en las promociones del bot con su precio por tamano y se vende alli mismo (ver "Vender combos por WhatsApp"). Ese texto del resumen se puede cambiar en Configuracion, Chatbot y WhatsApp (Textos del bot).
4. Una oferta nueva viene con carta y local marcados; WhatsApp viene marcado en descuento, 2x1, envio gratis y combos (el cupon no lo lleva). Las ofertas que ya existian conservan lo que tenian.
5. Los cupones se canjean en la carta web y en caja: el bot todavia no pide codigos, por eso WhatsApp aparece apagado y bloqueado en el cupon.
6. Los cambios de canal quedan en la auditoria como "cambiar_canales". El servidor no aplica desde el bot una oferta con WhatsApp apagado, aunque llegue su numero.

## Como se hace: Vender combos por WhatsApp
1. Abre el combo (Promociones, Combos), busca "¿Dónde aplica?" y marca "WhatsApp (bot)". Un combo nuevo ya viene con carta, local y WhatsApp marcados; si lo quieres solo en la carta o solo en el local, desmarca los otros. Un combo solo para WhatsApp no sale en la carta web ni en caja y mozo, y uno de solo carta o solo local nunca se ofrece ni se vende por el bot. Los combos que ya existian conservan lo que tenian: activa WhatsApp a mano en cada uno.
2. El cliente ve el combo en las promociones del bot (con el precio de cada tamaño) y en la lista de su categoria. Al elegirlo, el bot dice que incluye y le pregunta tamaño, las opciones del combo (bebidas, complemento, sabores) y, si el combo tiene partes con lista de productos (por ejemplo los juguetes de la Cajita), le pide cada eleccion una por una: 1 de 2, 2 de 2. Las opciones agotadas no se muestran.
3. Si una parte fija se agoto y el combo tiene plan B, el bot avisa "Hoy no hay Club Sandwich, ¿lo cambiamos por Empanada o Croissant?" con las alternativas; el precio del combo no cambia. El texto se puede cambiar en Configuracion, Chatbot y WhatsApp (Textos del bot).
4. Antes de agregarlo, el bot muestra el resumen con el total y pregunta si lo agrega o quiere cambiar. En cualquier momento el cliente puede escribir "atras" para corregir o "cancelar". Despues sigue el flujo normal de entrega y pago.
5. Al confirmar, el sistema valida de nuevo el stock, los dias, la hora y el limite de usos. Si algo se agoto justo en ese momento, el bot avisa con amabilidad y le deja elegir de nuevo esa parte con lo que hay. Por WhatsApp se arman hasta 5 combos a la vez.
6. Si el combo se agota, esta fuera de su dia u hora, o llego a su limite de usos, el bot deja de ofrecerlo solo; cuando vuelva a estar disponible reaparece sin tocar nada.

## Como se hace: Distinguir "Agotado automaticamente" de "Desactivada por ti"
1. "Agotado automaticamente · vuelve sola cuando haya stock" (naranja): el combo esta activo pero falta stock. Se muestra el motivo ("falta X, Y y las bebidas a elegir") y, si tiene plan B, "hay alternativas configuradas". Al reponer el stock vuelve solo a la carta y al bot; no hay que tocar nada. El sistema nunca cambia el estado Activo por stock.
2. "Desactivada por ti · no vuelve sola" (gris): alguien la desactivo a proposito. Sigue desactivada aunque haya stock y solo vuelve con el boton "Activar". Debajo se ve "Ultima vez desactivada: fecha por usuario".
3. Si esta desactivada y ademas falta stock, manda "Desactivada por ti" y aparece la nota "ademas hoy le falta stock".

## Como se hace: Crear un descuento directo
1. Dirigete a la pestana "Descuentos".
2. Pulsa el boton "+ Nuevo descuento".
3. Selecciona si el descuento se aplicara como porcentaje (por ejemplo 10% o 20%) o como monto fijo en soles.
4. Elige si la rebaja aplica a un producto individual o a una categoria entera de la carta.
5. Define los dias de la semana, los horarios validos y las fechas de inicio y fin del descuento.
6. Pulsa "Guardar descuento" y confirma con "Si, continuar".
Antes: [[productos]]
Ver tambien: [[caja]]

## Como se hace: Crear un cupon de descuento
1. Abre la pestana "Cupones".
2. Pulsa el boton "+ Nuevo cupon".
3. Escribe el codigo en letras mayusculas y numeros (por ejemplo: CAPRICHOS10).
4. Establece el valor del descuento, el consumo minimo requerido en la cuenta para aplicarlo y el limite maximo de usos generales o por persona vinculada a [[clientes]].
5. Pulsa "Crear cupon" y confirma con "Si, continuar".
Despues: [[caja]]
Ver tambien: [[clientes]]

## Como se hace: Pausar o desactivar una oferta activa
1. En la lista de promociones o descuentos, localiza la fila de la oferta en cuestion.
2. Pulsa el boton "Pausar" si deseas suspender la promocion temporalmente sin borrar su configuracion.
3. Para volver a encenderla en cualquier momento, pulsa "Activar".
4. Si la promocion llego a su fin definitivo, pulsa "Desactivar" y confirma la baja con "Si, confirmar".
Ver tambien: [[indicadores]]

## Errores y dudas comunes
- Como se prevé la apariencia de una oferta en la carta: en la pestana de promociones puedes pulsar el boton "Ver como se ve en la carta" para abrir una previsualizacion exacta de como vera el cliente la oferta en la carta web.
- Se pueden acumular cupones con ofertas automaticas: las condiciones de acumulacion se configuran en la pestana "Reglas". Por defecto, el sistema restringe combinaciones que afecten el margen minimo del negocio.
- Donde revisar canjes de cupones: dentro de la pestana "Cupones", pulsa el boton "Historial de cupones" para auditar que pedidos y clientes utilizaron cada codigo.

- El bot no me muestra una oferta: revisa que tenga "WhatsApp (bot)" marcado en "¿Dónde aplica?", que este activa y vigente hoy (dia y hora de Lima) y, si es combo, que no este agotado por stock.

## Quien puede hacerlo
- Administrador: es el unico rol autorizado para ingresar al modulo, crear promociones, configurar descuentos, emitir cupones y ajustar las reglas de acumulacion.
- Otros roles (Cajero, Cocina, Mozo, Repartidor, Almacen): no tienen acceso a este modulo.
