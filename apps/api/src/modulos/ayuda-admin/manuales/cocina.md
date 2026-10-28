---
modulo: cocina
titulo: Cocina
ruta: /admin/cocina
permiso: cocina/ver
roles: [ADMIN, CAJERO, COCINA]
relacionados: [caja, almacen, stock, pantallas, supervisor-codigo]
sugerencias:
  - Como despacho una comanda que ya prepare
  - Como pongo en pausa la cocina por alta demanda
  - Como marco un plato o ingrediente como agotado
  - Como devuelvo una comanda que despeje por error
---
# Cocina

## Para que sirve
Sistema de visualizacion y control de preparacion de comandas en tiempo real. Organiza los pedidos procedentes de [[caja]] por orden estricto de llegada, proyecta el estado en [[pantallas]], alerta sobre demoras, gestiona alta demanda y coordina mermas e insumos con [[almacen]] y [[stock]].

## Como se hace: Despejar una comanda preparada
1. En la pestana Pantalla del area, seleccionar el area de trabajo: Todas, Bebidas, Postres o Salados.
2. Las comandas pendientes aparecen primero, ordenadas de mas antigua a mas reciente, mostrando primero la que mas tiempo lleva esperando.
3. Al finalizar la elaboracion de los platos de esa comanda, pulsar el boton Despejar en la tarjeta del pedido y confirmar con Si, despejar.
4. La tarjeta sigue en la pantalla del area como seguimiento: el pedido no desaparece mientras otra area de ese mismo pedido siga pendiente.
5. Cada tarjeta muestra todas las lineas del pedido agrupadas por area (el nombre del area va como subtitulo pequeno). Cada linea lleva un check: verde (listo) cuando su area ya despejo, y un circulo vacio (pendiente) cuando no.
6. Si el area propia ya despejo, la tarjeta se marca como lista con el aviso "Tu area ya esta lista, falta: <areas pendientes>" y ya no tiene el boton Despejar.
7. Cuando todas las areas del pedido han despejado, el pedido sale de las pantallas de cocina y pasa a listo para [[repartos]].
Antes: [[caja]]
Despues: [[repartos]]
Ver tambien: [[pantallas]]

## Como se hace: Devolver una comanda despejada por error
1. Ir a la pestana Despejadas hoy en la barra superior.
2. Ubicar la comanda en la lista de despachos recientes.
3. Pulsar el boton Devolver a cocina.
4. La comanda volvera de inmediato a la pantalla activa conservando su tiempo transcurrido original.
Ver tambien: [[caja]]

## Como se hace: Activar el modo de alta demanda
1. Pulsar el boton Alta demanda en la cabecera superior.
2. Elegir entre aumentar el tiempo estimado de entrega (+10, +15, +20 minutos) o Pausar temporalmente la recepcion de nuevos pedidos online configurados en [[mirest]].
3. Pulsar Guardar configuracion. En la carta web y al cliente se les informara la nueva demora automaticamente.
Ver tambien: [[mirest]]

## Como se hace: Marcar un producto como agotado
1. Pulsar el boton Agotar producto en la cabecera.
2. Buscar el plato en el catalogo de [[productos]] o el ingrediente en [[stock]].
3. Elegir la duracion del agotado: Solo por el turno de hoy o Hasta que se reactive manualmente.
4. Pulsar Confirmar agotado. El producto dejara de estar disponible para pedidos de inmediato.
Despues: [[productos]]
Ver tambien: [[stock]]

## Como se hace: Registrar una merma de cocina
1. Pulsar el boton Mermas en la barra superior.
2. Seleccionar el insumo afectado registrado en [[stock]], ingresar la cantidad y unidad de medida.
3. Elegir el motivo: Se cayo, Vencido, Mal preparado u Otro (especificando detalle).
4. Pulsar Registrar merma. Si el insumo o cantidad requiere autorizacion, el sistema solicitara el Codigo del supervisor de 6 digitos obtenido en [[supervisor-codigo]] antes de confirmar.
Requiere: [[supervisor-codigo]]
Despues: [[almacen]]
Ver tambien: [[stock]]

## Errores y dudas comunes
- Las tarjetas cambian de color segun el tiempo de espera: verde (tiempo optimo), amarillo (alerta de preparacion) y rojo (pedido retrasado con mas de 13 minutos).
- Para silenciar o activar la campana de alerta sonora de nuevos pedidos, pulsar el icono de campana junto a las pestanas.
- Si una orden tiene platos de varias areas, cada area debe despejar su parte de forma independiente antes del despacho final.
- Las comandas que ya despejo tu area no cuentan en el contador de pendientes ni disparan la alerta: solo se muestran para seguimiento hasta que las demas areas terminen.

## Quien puede hacerlo
- Personal de Cocina y Administrador tienen control operativo total para despejar, agotar, activar alta demanda y registrar mermas.
- El Cajero puede ver la pantalla en modo consulta para verificar el estado de preparacion de los pedidos.
